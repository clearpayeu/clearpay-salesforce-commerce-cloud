'use strict';
/* global empty */

/* API Includes */
var Transaction = require('dw/system/Transaction');
var Order = require('dw/order/Order');
var Status = require('dw/system/Status');

/* Script Modules */
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('updatePaymentStatus');

var updatePaymentStatus = {};

/**
* update Clearpay payment status.
* @param {Object} order - order
* @returns {Object} - authorization or error
*/
updatePaymentStatus.handlePaymentStatus = function (order) {
    var apUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
    var apCheckoutUtilities = apUtilities.checkoutUtilities;
    var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
    var response;
    var finalPaymentStatus;
    var errorMessage;
    var responseCode;
    var paymentTransaction;
    var apInitialStatus;

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

    apInitialStatus = paymentTransaction.custom.apInitialStatus;
    Logger.debug('Clearpay Initial payment status :' + apInitialStatus);
    finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayHandlePaymentOrder').getPaymentStatus(order, apInitialStatus);
    response = (finalPaymentStatus.errorMessage) ? finalPaymentStatus.errorMessage : finalPaymentStatus;
    responseCode = apCheckoutUtilities.getPaymentResponseCode(finalPaymentStatus);

    if (response === 'SERVICE_UNAVAILABLE' || response.httpStatusCode === 500 || response === 'INTERNAL_SERVICE_ERROR') {
        finalPaymentStatus = require('*/cartridge/scripts/checkout/clearpayIdempotency').delayPayment(order, apInitialStatus);
    }

    Logger.debug('Clearpay final payment status :' + finalPaymentStatus);

    if (finalPaymentStatus === 'APPROVED') {
        return { authorized: true };
    } else if (finalPaymentStatus === 'PENDING') {
        return {
            error: true,
            ClearpayOrderErrorMessage: new Status(Status.ERROR, apInitialStatus, 'clearpay.api.declined'),
            apInitialStatus: !empty(order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.apInitialStatus) ? Order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.apInitialStatus : null
        };
    } else if (finalPaymentStatus === 'DECLINED') {
        errorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(responseCode, true);
        Transaction.begin();
        impactOrder.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.apInitialStatus = apInitialStatus;
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
        impactOrder.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().custom.apInitialStatus = apInitialStatus;
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
