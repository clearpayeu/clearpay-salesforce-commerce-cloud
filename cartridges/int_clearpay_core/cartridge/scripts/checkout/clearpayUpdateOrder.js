var clearpayConstants = require('*/cartridge/scripts/util/clearpayConstants');
var apUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var apCheckoutUtilities = apUtilities.checkoutUtilities;
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');

var clearpayUpdateOrder = {
    /**
     * updates order based of the payment status
     * @param {dw.order.Order} order - order
     * @param {Object} paymentResult - payment result
     * @param {'DIRECT_CAPTURE'|'AUTHORISE'} paymentMode - payment mode
     */
    handleUpdateOrder: function (order, paymentResult, paymentMode) {
        var paymentTransaction;

        try {
            paymentTransaction = this.getPaymentTransaction(order);
            if (paymentResult.status !== clearpayConstants.PAYMENT_STATUS.DECLINED) {
                this.savePaymentTransaction(paymentTransaction, paymentResult, paymentMode);
                this.saveOrder(order, paymentResult);
            } else {
                this.savePaymentTransactionDeclined(paymentTransaction, paymentMode);
            }
        } catch (exception) {
            var e = exception;
            Logger.error(e);
            throw e;
        }
    },
    /**
     * saves success payment transaction status
     * @param {dw.order.PaymentTransaction} paymentTransaction - transaction
     * @param {Object} paymentResult - result
     * @param {'DIRECT_CAPTURE'|'AUTHORISE'} paymentMode - mode
     * @returns {dw.order.PaymentTransaction} - transaction
     */
    // eslint-disable-next-line no-unused-vars
    savePaymentTransaction: function (paymentTransaction, paymentResult, paymentMode) {
        throw new Error('Should be implemented in child module for specific API version (e.g. "./v2/clearpayUpdateOrder")');
    },
    /**
     * retrieves payment transaction status
     * @param {dw.order.Order} order - order
     * @returns {dw.order.PaymentTransaction} - payment transaction
     */
    getPaymentTransaction: function (order) {
        var paymentTransaction;
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();

        if (!paymentMethodName) {
            return null;
        }

        for (var i = 0; i < order.paymentInstruments.length; i += 1) {
            var paymentInstrument = order.paymentInstruments[i];

            if (paymentInstrument.paymentMethod.equals(paymentMethodName)) {
                paymentTransaction = paymentInstrument.paymentTransaction;
            }
        }
        return paymentTransaction;
    },
    /**
     * retrieves payment processor
     * @returns {dw.order.PaymentProcessor} - processor
     */
    getPaymentProcessor: function () {
        var PaymentMgr = require('dw/order/PaymentMgr');
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();

        if (!paymentMethodName) {
            return null;
        }

        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentMethodName).paymentProcessor;
        return paymentProcessor;
    },
    /**
     * saves order status based on payment transaction status
     * @param {dw.order.Order} order - order
     * @param {Object} paymentResult - result
     * @returns {dw.order.Order} - order
     */
    saveOrder: function (order, paymentResult) {
        var Order = require('dw/order/Order');
        var outOrder = order;
        Transaction.begin();
        outOrder.custom.apIsClearpayOrder = true;
        if (paymentResult.status === clearpayConstants.PAYMENT_STATUS.APPROVED) {
            outOrder.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
        } else {
            outOrder.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        }

        Transaction.commit();
        return outOrder;
    },
    /**
     * saves declined payment transaction status
     * @param {dw.order.PaymentTransaction} paymentTransaction - transaction
     * @param {'DIRECT_CAPTURE'|'AUTHORISE'} paymentMode - payment mode
     * @returns {dw.order.PaymentTransaction} - transaction
     */
    savePaymentTransactionDeclined: function (paymentTransaction, paymentMode) {
        var payTrans = paymentTransaction;
        Transaction.begin();
        payTrans.setPaymentProcessor(this.getPaymentProcessor());
        payTrans.custom.apPaymentMode = paymentMode;
        payTrans.custom.apInitialStatus = clearpayConstants.PAYMENT_STATUS.DECLINED;
        payTrans.custom.apToken = null;
        if (paymentMode === clearpayConstants.PAYMENT_MODE.DIRECT_CAPTURE) {
            payTrans.custom.apDirectPaymentStatus = clearpayConstants.PAYMENT_STATUS.UNKNOWN;
        } else {
            payTrans.custom.apAuthoriseStatus = clearpayConstants.PAYMENT_STATUS.UNKNOWN;
        }
        Transaction.commit();

        return payTrans;
    }
};

module.exports = clearpayUpdateOrder;
