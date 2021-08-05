var BaseOrder = require('*/cartridge/scripts/order/order');
var Amount = require('*/cartridge/scripts/order/amount');

var Order = function () {
    BaseOrder.call(this);
    this.amount = new Amount();
};

module.exports = Order;
