'use strict';

var PAYMENT_STATUS = require('*/cartridge/scripts/util/clearpayConstants').PAYMENT_STATUS;
var sitePreferencesUtilities = require('*/cartridge/scripts/util/clearpayUtilities').sitePreferencesUtilities;
var clearpayUpdateOrder = require('*/cartridge/scripts/checkout/clearpayUpdateOrder');
var baseUpdateOrderService = require('*/cartridge/scripts/logic/services/clearpayUpdateOrderService');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayHandlePaymentOrder');

/**
 * retrieve payment status
 * @param {number} paymentStatus - payment status
 * @returns {number} - payment status
 */
var parsePaymentStatus = function (paymentStatus) {
    return (paymentStatus === PAYMENT_STATUS.SUCCESS) ? PAYMENT_STATUS.APPROVED : paymentStatus;
};

/**
 * updates order service status
 * @param {Object} order - order
 * @param {number} paymentStatus - payment status
 * @param {Object} expressCheckoutModel - expressCheckoutModel
 * @returns {number} - payment status
 */
function getPaymentStatus(order, paymentStatus, expressCheckoutModel) {
    var parsedPaymentStatus = parsePaymentStatus(paymentStatus);
    Logger.debug('parsed payment status : ' + parsedPaymentStatus);
    var paymentResult;
    try {
        paymentResult = baseUpdateOrderService.handleOrder(order, parsedPaymentStatus, expressCheckoutModel);
        if (paymentResult && paymentResult.status === 'DECLINED') {
            parsedPaymentStatus = paymentResult.status;
        }
        clearpayUpdateOrder.handleUpdateOrder(order, paymentResult, sitePreferencesUtilities.getPaymentMode().value);
        Logger.debug('UpdatedOrder service status : ' + parsedPaymentStatus);
    } catch (exception) {
        Logger.error('Exception occured while updating order status ' + exception);
        return {
            error: true,
            errorMessage: exception
        };
    }
    return parsedPaymentStatus;
}

module.exports = {
    getPaymentStatus: getPaymentStatus
};
