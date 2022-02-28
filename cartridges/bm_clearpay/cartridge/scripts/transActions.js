/**
* ClearPay Transaction Actions
*
* @input Action: String
* @input OrderNo: String
* @input Amount: String
*
*/

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var UUIDUtils = require('dw/util/UUIDUtils');

/* Script Modules */
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('TransActions');
var clearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var brandUtilities = clearpayUtilities.brandUtilities;

/**
 * updates the order status
 * @param {string} orderNo - orderNo
 * */
function updateOrderStatus(orderNo) {
    var Order = OrderMgr.getOrder(orderNo);

    try {
        Transaction.begin();
        Order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        Order.setStatus(Order.ORDER_STATUS_CANCELLED);
        Transaction.commit();
    } catch (e) {
        Transaction.rollback();
        Logger.error('Exception occured while updating the order status after Refund Transaction' + e);
    }
}

/**
 * generate Refund Request
 * @param {string} orderNo - orderNo
 * @param {number} amount - amount
 * @param {string} currency - currency
 * @param {string} paymentID - paymentID
 * @returns {Object} data- data
 * */
function makeRefundRequest(orderNo, amount, currency, paymentID) {
    var data = {
        paymentID: paymentID,
        amount: {
            amount: amount,
            currency: currency
        },
        requestId: UUIDUtils.createUUID(),
        orderNo: orderNo
    };

    return data;
}

/**
 * call action
 * @param {Object} request - request
 * @returns {Object} response - response
 * */
function callAction(request) {
    var refundUtil = require('*/cartridge/scripts/util/refundUtilities.js');
    var response;

    if (refundUtil && !(refundUtil.error)) {
        response = refundUtil.createRefund(request);
    }

    return response;
}

/**
 * Refund action
 * @param {string} orderNo - orderNo
 * @param {string} amountString - amount as string value
 * @returns {Object} status
 * */
function refund(orderNo, amountString) {
    var order = OrderMgr.getOrder(orderNo);
    var paymentInstrument;
    var cpPaymentInstrument;
    var paymentTransaction;
    var status = false;
    var amountArray = amountString.split(' ');
    var currency = amountArray[0];
    var amount = amountArray[1];
    var response;
    var paymentID;
    var request;
    var error;

    var iter = order.getPaymentInstruments().iterator();

    while (iter.hasNext()) {
        cpPaymentInstrument = iter.next();
        if (cpPaymentInstrument.paymentMethod === 'AFTERPAY' || cpPaymentInstrument.paymentMethod === 'CLEARPAY') {
            paymentInstrument = cpPaymentInstrument;
        }
    }

    paymentTransaction = paymentInstrument.getPaymentTransaction();
    paymentID = paymentTransaction.custom.cpPaymentID;
    amount = parseFloat(amount, 10);
    brandUtilities.initBrand(order.getCustomerLocaleID());

    request = makeRefundRequest(orderNo, amount, currency, paymentID);

    Logger.debug('Refund request: ' + JSON.stringify(request));

    Transaction.wrap(function () {
        paymentTransaction.custom.cpRefundRequestId = request.requestId;
    });

    response = callAction(request);

    var jsonResponse = !empty(response.object) ? JSON.parse(response.object) : response;

    Logger.debug('Refund response: ' + JSON.stringify(jsonResponse));

    if (jsonResponse === null || (jsonResponse && jsonResponse.refundId === undefined)) {
        error = Resource.msg('transaction.unknown', 'clearpay', null);
    }

    if (jsonResponse != null || (jsonResponse && jsonResponse.refundId)) {
        status = true;

        Transaction.begin();
        paymentTransaction.custom.cpRefundID = jsonResponse.refundId;
        Transaction.commit();

        updateOrderStatus(orderNo);
    }

    return {
        status: status,
        error: error
    };
}

/**
 * Internal methods
 * @param {string} orderNo - orderNo
 * @param {number} amount - amount
 * @param {string} action - action
 * @returns {Object} result - result
 */
exports.refund = function (orderNo, amount, action) {
    return refund(orderNo, amount, action);
};
