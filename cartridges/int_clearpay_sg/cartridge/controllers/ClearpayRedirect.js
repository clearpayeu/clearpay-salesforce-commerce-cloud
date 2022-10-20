'use strict';
/* global empty, request */

/**
 * Controller to handle the response from Clearpay
 *
 * @module controllers/ClearpayRedirect
 */

/* API Includes */
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');

/* Global variables */
var sitePreferences = require('*/cartridge/scripts/util/clearpayUtilities.js').sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var COPlaceOrder = require('*/cartridge/controllers/COPlaceOrder');
var COSummary = require('*/cartridge/controllers/COSummary');

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var guard = require(ctrlCartridgeName + '/cartridge/scripts/guard');
var Cart = app.getModel('Cart');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayRedirect');

/**
 * Handles the payment status returned by the Clearpay. Based on the status Order will be submitted .
 */
function HandleResponse() {
    var clearpayPaymentInstrument;
    var paymentInstrument;
    var cart;
    var iter;
    var paymentStatus;
    var redirectURL;
    var PreapprovalResult;
    var placeOrderResult;
    var productExists;

    cart = Cart.get();
    iter = cart.object.getPaymentInstruments().iterator();

    while (iter.hasNext()) {
        clearpayPaymentInstrument = iter.next();

        if (clearpayPaymentInstrument.paymentMethod === 'CLEARPAY') {
            paymentInstrument = clearpayPaymentInstrument;
        }
    }

    paymentStatus = request.httpParameterMap.status.getStringValue();

    if (paymentStatus === 'SUCCESS') {
        var orderTokenString = request.httpParameterMap.orderToken.getStringValue();
        productExists = require('*/cartridge/scripts/checkout/clearpayTokenConflict').checkTokenConflict(cart.object, orderTokenString);
        PreapprovalResult = require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(cart.object, {
            status: paymentStatus,
            orderToken: orderTokenString
        });

        if (!productExists || PreapprovalResult.error) {
            redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.invalid', session.privacy.clearpayBrand, null));
        } else {
            try {
                placeOrderResult = COPlaceOrder.Start(); // eslint-disable-line
                Logger.debug('PlaceOrder status :' + JSON.stringify(placeOrderResult));

                if (placeOrderResult.order_created) {
                    COSummary.ShowConfirmation(placeOrderResult.Order); // eslint-disable-line
                } else if (placeOrderResult.error) {
                    var error = !empty(placeOrderResult.clearpayOrderAuthorizeError) ? placeOrderResult.clearpayOrderAuthorizeError : Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null);
                    redirectURL = URLUtils.https('COBilling-Start', 'clearpay', error);
                }
            } catch (e) {
                Logger.error('Exception occured while creating order :' + e);
                redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null));
            }
        }
    } else if (paymentStatus === 'CANCELLED') {
        redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('clearpay.api.cancelled', session.privacy.clearpayBrand, null));
    } else if (paymentInstrument.getPaymentTransaction().custom.cpToken !== request.httpParameterMap.orderToken.stringValue) {
        redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null));
    } else {
        redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null));
    }

    if (!empty(redirectURL)) {
        Logger.debug('ClearpayRedirectUrl: ' + redirectURL);

        app.getView({
            ClearpayRedirectUrl: redirectURL
        }).render('checkout/redirect');
    }
}

/*
* Web exposed methods
*/

/** Payment status handling.
 * @see module:controllers/ClearpayRedirect~Confirm */
exports.HandleResponse = guard.ensure(['https'], HandleResponse);
