/* eslint no-underscore-dangle: 0 */
var BaseOrderRequestBuilder = require('*/cartridge/scripts/order/orderRequestBuilder');

/**
 * @class
 * @classdesc defines order request object
 */
var OrderRequestBuilder = function () {
    BaseOrderRequestBuilder.call(this);
};

OrderRequestBuilder.prototype = Object.create(BaseOrderRequestBuilder.prototype);

/**
 * builds address details
 * @private
 * @param {string} type - type
 * @param {dw.order.OrderAddress} address - address
 */
OrderRequestBuilder.prototype._buildAddress = function (type, address) {
    BaseOrderRequestBuilder.prototype._buildAddress.call(this, type, address);
    this.context[type].suburb = address.city || '';
    this.context[type].state = address.stateCode || '';
};

/**
 * builds total amount details
 * @param {dw.order.Basket} basket - basket
 * @returns {Object} this - this object
 */
OrderRequestBuilder.prototype.buildTotalAmount = function (basket) {
    var paymentTransaction = this._getPaymentTransaction(basket);

    if (!paymentTransaction) {
        return null;
    }

    this.context.totalAmount.amount = paymentTransaction.amount.value;
    this.context.totalAmount.currency = basket.getCurrencyCode();
    return this;
};

module.exports = OrderRequestBuilder;
