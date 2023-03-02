'use strict';

/* API Includes */
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var Status = require('dw/system/Status');

/* Script Modules */
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('updatePaymentStatus');

var updatePaymentStatus = {};

/* eslint-disable no-useless-escape */
/**
* update Clearpay payment status.
* @param {object} order - order
* @returns {object} - authorization or error
*/
/* eslint-enable no-useless-escape */
updatePaymentStatus.handlePaymentStatus = function (order) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
    var ECPaymentHelpers = require('*/cartridge/scripts/payment/expressCheckoutPaymentHelpers');
    var cpCheckoutUtilities = require('*/cartridge/scripts/util/clearpayUtilities').checkoutUtilities;
    var response;
    var finalPaymentStatus;
    var errorMessage;
    var responseCode;
    var paymentTransaction;
    var cpInitialStatus;
    var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
    var impactOrder = order;

    if (!paymentMethodName) {
        return null;
    }

    for (var i = 0; i < order.paymentInstruments.length; i += 1) {
        var paymentInstrument = order.paymentInstruments[i];

        if (paymentInstrument.paymentMethod.equals(paymentMethodName)) {
            paymentTransaction = paymentInstrument.paymentTransaction;
        }
    }

    cpInitialStatus = paymentTransaction.custom.cpInitialStatus;
    Logger.debug('Clearpay Initial payment status :' + cpInitialStatus);

    // Express Checkout
    var orderToken = order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.cpToken;
    var expressCheckoutModel = null;
    // Only do clearpay express checkout specific stuff if ClearpaySession is valid. Otherwise, assume that
    // we are doing a capture of non-express checkout order
    if (ClearpaySession.isValid()) {
        if (ClearpaySession.getToken() === orderToken) {
            expressCheckoutModel = ECPaymentHelpers.createExpressCheckoutModelFromOrderAndSession(order);
        }
        // Theoretically, session may have changed while we did the change checks, so
        // make sure the token in the session is still the one we expect. If not, we
        // fail the order
        if (ClearpaySession.getToken() != orderToken) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            Logger.error('Payment has been declined. Session changed so there is no way to verify that order created was correct.');
            ClearpaySession.clearSession();

            return {
                ClearpayOrderErrorMessage: Resource.msg('expresscheckout.error.paymentinvalidsession', 'clearpay', null),
                error: true
            };
        }
    }

    finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayHandlePaymentOrder').getPaymentStatus(order, cpInitialStatus, expressCheckoutModel);
    response = (finalPaymentStatus.errorMessage) ? finalPaymentStatus.errorMessage : finalPaymentStatus;
    responseCode = cpCheckoutUtilities.getPaymentResponseCode(finalPaymentStatus);

    if (response === 'SERVICE_UNAVAILABLE' || response.httpStatusCode === 500 || response === 'INTERNAL_SERVICE_ERROR') {
        finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayIdempotency').delayPayment(order, cpInitialStatus, expressCheckoutModel);
    }

    Logger.debug('Clearpay final payment status :' + finalPaymentStatus);

    if (finalPaymentStatus === 'APPROVED' || finalPaymentStatus === 'ACTIVE') {
        return { authorized: true };
    } else if (finalPaymentStatus === 'PENDING') {
        return {
            error: true,
            ClearpayOrderErrorMessage: new Status(Status.ERROR, cpInitialStatus, 'clearpay.api.declined'),
            cpInitialStatus: !empty(order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.cpInitialStatus) ? Order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.cpInitialStatus : null
        };
    } else if (finalPaymentStatus === 'DECLINED') {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        impactOrder.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
        Transaction.commit();
        Logger.error('Payment has been declined : ' + responseCode);
        if (ClearpaySession.isValid()) {
            ClearpaySession.clearSession();
        }
        return {
            ClearpayOrderErrorMessage: errorMessage,
            error: true
        };
    }

    if (finalPaymentStatus.error) {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        impactOrder.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.cpInitialStatus = cpInitialStatus;
        Transaction.commit();
        Logger.error('Error while Authorizing Order : '
            + require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode));
    }

    return {
        ClearpayOrderErrorMessage: errorMessage,
        error: true
    };
};

module.exports = updatePaymentStatus;
