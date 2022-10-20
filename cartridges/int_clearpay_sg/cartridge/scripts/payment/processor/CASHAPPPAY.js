'use strict';
/* global empty, request */

/* API Includes */
var Transaction = require('dw/system/Transaction');
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities.js');
var sitePreferences = ClearpayUtilities.sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var Cart = require(ctrlCartridgeName + '/cartridge/scripts/models/CartModel');
var OrderMgr = require('dw/order/OrderMgr');
var Status = require('dw/system/Status');
var Resource = require('dw/web/Resource');

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var brandUtilities = ClearpayUtilities.brandUtilities;
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('CASHAPP');
var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');

/**
 * Handles Clearpay token generation process
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);

    Transaction.wrap(function () {
        cart.removeExistingPaymentInstruments('CASHAPPPAY');
        cart.createPaymentInstrument('CASHAPPPAY', cart.getNonGiftCertificateAmount());
    });

    // Recalculate the payments. If there is only gift certificates, make sure it covers the order total, if not
    // back to billing page.
    Transaction.wrap(function () {
        if (!cart.calculatePaymentTransactionTotal()) {
            app.getController('COBilling').Start(); // eslint-disable-line
        }

        return {};
    });

    var clearpayTokenResponse = require('*/cartridge/scripts/checkout/clearpayGetToken').getToken(args.Basket,true);
    Logger.debug('Token value returned to - CASHAPPPAY.JS : ' + JSON.stringify(clearpayTokenResponse));

    var clearpayToken = clearpayTokenResponse.errorMessage ? clearpayTokenResponse.errorMessage : clearpayTokenResponse;
    var responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(clearpayTokenResponse);

    if (clearpayTokenResponse.error) {
        var errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Logger.error('Error while generating Token : ' + errorMessage);
        return {
            error: true
        };
    }

    if(ClearpaySession.isValid()) {
        ClearpaySession.clearSession();
    }
    ClearpaySession.newSession(clearpayToken.cpToken);
    ClearpaySession.setItemsChecksum(ClearpayCOHelpers.computeBasketProductLineItemChecksum(cart.object));
    ClearpaySession.setIsCashAppPay(true);
    return {
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
    var cpInitialStatus = Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus;
    var orderToken = Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpToken;
    var expressCheckoutModel = null;

    Logger.debug('CashApp getToken :' + ClearpaySession.getToken());
    if (ClearpaySession.isValid()) {
        if (ClearpaySession.getToken() != orderToken) {
            Transaction.begin();
            Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
            Order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_NOTPAID);
            OrderMgr.failOrder(Order);
            Transaction.commit();
            Logger.error('Payment has been declined. Session changed so there is no way to verify that order created was correct.');
            ClearpaySession.clearSession();

            return {
                ClearpayOrderErrorMessage: Resource.msg('expresscheckout.error.paymentinvalidsession', brandUtilities.getBrand(), null),
                error: true
            };
        }
    }
    // Clear the Clearpay session regardless of capture outcome
	ClearpaySession.clearSession();
    Logger.debug('Clearpay Initial payment status :' + cpInitialStatus);
    finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayHandlePaymentOrder').getPaymentStatus(Order, cpInitialStatus, expressCheckoutModel,'true');
    response = !empty(finalPaymentStatus.errorMessage) ? finalPaymentStatus.errorMessage : finalPaymentStatus;
    responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(finalPaymentStatus);

    if (response === 'SERVICE_UNAVAILABLE' || response.httpStatusCode === 500 || response === 'INTERNAL_SERVICE_ERROR') {
        finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayIdempotency').delayPayment(Order, cpInitialStatus, expressCheckoutModel);
    }

    Logger.debug('Clearpay final payment status :' + finalPaymentStatus);

    if (finalPaymentStatus === 'APPROVED') {
        return { authorized: true };
    } else if (finalPaymentStatus === 'PENDING') {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, cpInitialStatus, 'clearpay.api.declined'),
            cpInitialStatus: !empty(Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus) ? Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus : null
        };
    } else if (finalPaymentStatus === 'DECLINED') {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
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
        Order.getPaymentInstruments('CASHAPPPAY')[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
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
