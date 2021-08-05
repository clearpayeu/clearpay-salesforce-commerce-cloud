'use strict';
/* global empty, request */

/* API Includes */
var Transaction = require('dw/system/Transaction');
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities.js');
var sitePreferences = ClearpayUtilities.sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var Cart = require(ctrlCartridgeName + '/cartridge/scripts/models/CartModel');
var OrderMgr = require('dw/order/OrderMgr');
var URLUtils = require('dw/web/URLUtils');
var Status = require('dw/system/Status');

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('CLEARPAY');

/**
 * Handles Clearpay token generation process
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);

    Transaction.wrap(function () {
        cart.removeAllPaymentInstruments();
        cart.createPaymentInstrument('CLEARPAY', cart.getNonGiftCertificateAmount());
    });

    // Recalculate the payments. If there is only gift certificates, make sure it covers the order total, if not
    // back to billing page.
    Transaction.wrap(function () {
        if (!cart.calculatePaymentTransactionTotal()) {
            app.getController('COBilling').Start(); // eslint-disable-line
        }

        return {};
    });

    var afterPayTokenResponse = require('*/cartridge/scripts/checkout/clearpayGetToken').getToken(args.Basket);
    Logger.debug('Token value returned to - CLEARPAY.JS : ' + JSON.stringify(afterPayTokenResponse));

    var afterPayToken = afterPayTokenResponse.errorMessage ? afterPayTokenResponse.errorMessage : afterPayTokenResponse;
    var responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(afterPayTokenResponse);

    if (afterPayTokenResponse.error) {
        var errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Logger.error('Error while generating Token : '
            + require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode));
        var redirectURL = URLUtils.https('COBilling-Start', 'clearpay', errorMessage);

        app.getView({
            ClearpayRedirectUrl: redirectURL
        }).render('checkout/redirect');
    }
    var brandUtilities = ClearpayUtilities.brandUtilities;
    var scriptURL = brandUtilities.getBrandSettings().javaScriptUrl;
    var countryCode = brandUtilities.getCountryCode();

    app.getView({
        apBrand: brandUtilities.getBrand(),
        apJavascriptURL: scriptURL,
        apToken: afterPayToken,
        countryCode: countryCode
    }).render('checkout/clearpayredirect');

    return {
        redirect: true,
        success: true
    };
}

/**
 * Authorizes Clearpay Order process.
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Authorise(args) {
    var response;
    var finalPaymentStatus;
    var errorMessage;
    var responseCode;
    var Order = OrderMgr.getOrder(args.OrderNo);
    var apInitialStatus = Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.apInitialStatus;

    Logger.debug('Clearpay Initial payment status :' + apInitialStatus);
    finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayHandlePaymentOrder').getPaymentStatus(Order, apInitialStatus);
    response = !empty(finalPaymentStatus.errorMessage) ? finalPaymentStatus.errorMessage : finalPaymentStatus;
    responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(finalPaymentStatus);

    if (response === 'SERVICE_UNAVAILABLE' || response.httpStatusCode === 500 || response === 'INTERNAL_SERVICE_ERROR') {
        finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayIdempotency').delayPayment(Order, apInitialStatus);
    }

    Logger.debug('Clearpay final payment status :' + finalPaymentStatus);

    if (finalPaymentStatus === 'APPROVED') {
        return { authorized: true };
    } else if (finalPaymentStatus === 'PENDING') {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, apInitialStatus, 'clearpay.api.declined'),
            apInitialStatus: !empty(Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.apInitialStatus) ? Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.apInitialStatus : null
        };
    } else if (finalPaymentStatus === 'DECLINED') {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.apInitialStatus = apInitialStatus;
        Transaction.commit();

        Logger.error('Payment has been declined : ' + responseCode);
        return {
            ClearpayOrderErrorMessage: errorMessage,
            error: true
        };
    }

    if (finalPaymentStatus.error) {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.apInitialStatus = apInitialStatus;
        Transaction.commit();

        Logger.error('Error while Authorizing Order : ' + responseCode);
    }

    return {
        ClearpayOrderErrorMessage: errorMessage,
        error: true
    };
}

/*
 * Local methods
 */
exports.Handle = Handle;
exports.Authorise = Authorise;
