'use strict';

/* API Includes */
var Transaction = require('dw/system/Transaction');
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities.js');
var sitePreferences = ClearpayUtilities.sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var Cart = require(ctrlCartridgeName + '/cartridge/scripts/models/CartModel');
var OrderMgr = require('dw/order/OrderMgr');
var URLUtils = require('dw/web/URLUtils');
var Status = require('dw/system/Status');
var Resource = require('dw/web/Resource');

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('CLEARPAY');
var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var ECPaymentHelpers = require('*/cartridge/scripts/payment/expressCheckoutPaymentHelpers');
var brandUtilities = ClearpayUtilities.brandUtilities;

/**
 * Handles Clearpay token generation process
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);

    Transaction.wrap(function () {
        cart.removeExistingPaymentInstruments('CLEARPAY');
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

    var clearPayTokenResponse = require('*/cartridge/scripts/checkout/clearpayGetToken').getToken(args.Basket);
    Logger.debug('Token value returned to - CLEARPAY.JS : ' + JSON.stringify(clearPayTokenResponse));

    var clearPayToken = clearPayTokenResponse.errorMessage ? clearPayTokenResponse.errorMessage : clearPayTokenResponse;
    var responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(clearPayTokenResponse);

    if (clearPayTokenResponse.error) {
        var errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Logger.error('Error while generating Token : '
            + require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode));
        var redirectURL = URLUtils.https('COBilling-Start', 'clearpay', errorMessage);

        app.getView({
            ClearpayRedirectUrl: redirectURL
        }).render('checkout/redirect');
    }
    var scriptURL = brandUtilities.getBrandSettings().javaScriptUrl;
    var countryCode = brandUtilities.getCountryCode();

    app.getView({
        cpBrand: brandUtilities.getBrand(),
        cpJavascriptURL: scriptURL,
        cpToken: clearPayToken,
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
    var cpInitialStatus = Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpInitialStatus;
    var orderToken = Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpToken;

    var expressCheckoutModel = null;
    Logger.debug('ClearpaySession getToken :' + ClearpaySession.getToken());
    // Only do clearpay express checkout specific stuff if ClearpaySession is valid. Otherwise, assume that
    // we are doing a capture of non-express checkout order
    if (ClearpaySession.isValid()) {
        if (ClearpaySession.getToken() == orderToken) {
            expressCheckoutModel = ECPaymentHelpers.createExpressCheckoutModelFromOrderAndSession(Order);
        }
        // Theoretically, session may have changed while we did the change checks, so
        // make sure the token in the session is still the one we expect. If not, we
        // fail the order
        if (ClearpaySession.getToken() != orderToken) {
            return Transaction.wrap(function () {
                OrderMgr.failOrder(Order);
                Logger.error('Payment has been declined. Session changed so there is no way to verify that order created was correct.');
                ClearpaySession.clearSession();
                return {
                    ClearpayOrderErrorMessage: Resource.msg('expresscheckout.error.paymentinvalidsession', brandUtilities.getBrand(), null),
                    error: true
                };
            });
        }
    }
    // Clear the Clearpay session regardless of capture outcome
    ClearpaySession.clearSession();
    Logger.debug('Clearpay Initial payment status :' + cpInitialStatus);
    finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayHandlePaymentOrder').getPaymentStatus(Order, cpInitialStatus, expressCheckoutModel);
    response = !empty(finalPaymentStatus.errorMessage) ? finalPaymentStatus.errorMessage : finalPaymentStatus;
    responseCode = ClearpayUtilities.checkoutUtilities.getPaymentResponseCode(finalPaymentStatus);

    if (response === 'SERVICE_UNAVAILABLE' || response.httpStatusCode === 500 || response === 'INTERNAL_SERVICE_ERROR') {
        finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayIdempotency').delayPayment(Order, cpInitialStatus, expressCheckoutModel);
    }

    Logger.debug('Clearpay final payment status :' + finalPaymentStatus);

    if (finalPaymentStatus === 'APPROVED' || finalPaymentStatus === 'ACTIVE') {
        return { authorized: true };
    } else if (finalPaymentStatus === 'PENDING') {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, cpInitialStatus, 'clearpay.api.declined'),
            cpInitialStatus: !empty(Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpInitialStatus) ? Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpInitialStatus : null
        };
    } else if (finalPaymentStatus === 'DECLINED') {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
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
        Order.getPaymentInstruments('CLEARPAY')[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
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
