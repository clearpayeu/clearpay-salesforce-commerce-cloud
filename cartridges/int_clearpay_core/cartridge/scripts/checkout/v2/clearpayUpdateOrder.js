var Transaction = require('dw/system/Transaction');
var clearpayConstants = require('*/cartridge/scripts/util/clearpayConstants');
var apUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var clearpayUpdateOrder = require('*/cartridge/scripts/checkout/clearpayUpdateOrder');

/**
 * saves success payment transaction status
 * @param {dw.order.PaymentTransaction} paymentTransaction - transaction
 * @param {Object} paymentResult - result
 * @param {'DIRECT_CAPTURE'|'AUTHORISE'} paymentMode - mode
 * @returns {dw.order.PaymentTransaction} - transaction
 */
clearpayUpdateOrder.savePaymentTransaction = function (paymentTransaction, paymentResult, paymentMode) {
    var Money = require('dw/value/Money');
    var BrandUtilities = apUtilities.brandUtilities;
    var payTrans = paymentTransaction;
    var amount = null;

    Transaction.wrap(function () {
        payTrans.setTransactionID((paymentResult.id) ? paymentResult.id : null);
        payTrans.setPaymentProcessor(clearpayUpdateOrder.getPaymentProcessor());
        payTrans.custom.apPaymentID = (paymentResult.id) ? paymentResult.id : null;
        payTrans.custom.apPaymentMode = paymentMode;
        payTrans.custom.apCountryCode = BrandUtilities.getCountryCode();

        if (paymentMode === clearpayConstants.PAYMENT_MODE.DIRECT_CAPTURE) {
            payTrans.custom.apDirectPaymentStatus = paymentResult.status;
            amount = empty(paymentResult.originalAmount) ? null : new Money(parseFloat(paymentResult.originalAmount.amount), paymentResult.originalAmount.currency);
        } else {
            payTrans.custom.apAuthoriseStatus = paymentResult.status;
            amount = empty(paymentResult.openToCaptureAmount) ? null : new Money(parseFloat(paymentResult.openToCaptureAmount.amount), paymentResult.openToCaptureAmount.currency);
        }

        payTrans.setAmount(amount);
    });

    return payTrans;
};

module.exports = clearpayUpdateOrder;
