'use strict';

/* global empty, request */
/* API Includes */
var URLUtils = require('dw/web/URLUtils');
var	Resource = require('dw/web/Resource');

/* Global variables */
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var sitePreferences = ClearpayUtilities.sitePreferencesUtilities;
var cpBrandUtilities = ClearpayUtilities.brandUtilities;
var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');

/* Script Modules */
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var guard = require(ctrlCartridgeName + '/cartridge/scripts/guard');
var COPlaceOrder = require('*/cartridge/controllers/COPlaceOrder');
var COSummary = require('*/cartridge/controllers/COSummary');
var Cart = app.getModel('Cart');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('CashApp');

/**
 * Handles the payment status returned by the Clearpay. Based on the status Order will be submitted .
 */
function HandleResponse() {
    var cart;
    var paymentStatus;
    var redirectURL;
    var PreapprovalResult;
    var placeOrderResult;
    var basketValid = false;

    cart = Cart.get();

    paymentStatus = request.httpParameterMap.status.getStringValue();
    var itemsChecksum = ClearpayCOHelpers.computeBasketProductLineItemChecksum(cart.object);
    if(ClearpaySession.isValid()) {
        if (itemsChecksum == ClearpaySession.getItemsChecksum()) {
            basketValid = true;
        }
        ClearpaySession.clearSession();
    }

    if(basketValid) {
        if (paymentStatus === 'SUCCESS') {
            var orderTokenString = request.httpParameterMap.orderToken.getStringValue();
            PreapprovalResult = require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(cart.object, {
                status: paymentStatus,
                orderToken: orderTokenString,
                isCashAppPay: 'true'
            });

            if (PreapprovalResult.error) {
                redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null));
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
        } else if (paymentStatus === 'DECLINED') {
            redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('clearpay.api.declined', session.privacy.clearpayBrand, null));
        } else {
            redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', session.privacy.clearpayBrand, null));
        }
    } else {
        redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('cashapppay.error.missmatch', session.privacy.clearpayBrand, null));
    }

    if (!empty(redirectURL)) {
        app.getView({
            ClearpayRedirectUrl: redirectURL
        }).render('checkout/redirect');
    }
}

function HandleMobileResponse() {
    var cash_request_id = request.httpParameterMap.cash_request_id.getStringValue();
    if (!empty(cash_request_id)) {
        var scriptURL = cpBrandUtilities.getBrandSettings().javaScriptUrl;
        app.getView({
            cpJavascriptURL: scriptURL
        }).render('checkout/cashAppMobile');
    } else {
        var redirectURL = URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('cashapppay.error.missmatch', session.privacy.clearpayBrand, null));
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
exports.HandleMobileResponse = guard.ensure(['https'], HandleMobileResponse);
