'use strict';

var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayTokenConflict');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
/**
* validates the generated token to avoid duplication for the same order
* @param {Object} basket - basket
* @param {string} token - token
* @returns {boolean} - product present or not
*/
function checkTokenConflict(basket, token) {
    var sameBasket = true;
    var tokenValidate;
    try {
        tokenValidate = require('*/cartridge/scripts/util/getOrderToken').validateOrderToken(token);
    } catch (exception) {
        Logger.error('Exception to getOrders service: ' + exception);
        return {
            error: true,
            errorMessage: exception
        };
    }

    var cksum = ClearpayCOHelpers.computeResponseProductLineItemChecksum(tokenValidate);
    if (cksum !== ClearpayCOHelpers.computeBasketProductLineItemChecksum(basket)) {
        sameBasket = false;
    }
    return sameBasket;
}

module.exports = {
    checkTokenConflict: checkTokenConflict
};
