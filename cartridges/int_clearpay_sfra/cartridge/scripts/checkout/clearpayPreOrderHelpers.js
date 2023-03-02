'use strict';

var clearpayPreOrderTools = {
    getCartSubtotal: function (basket) {
        var parsePrice = require('~/cartridge/scripts/util/parsePriceClearpay.js');
        if (basket) {
            var TotalsModel = require('*/cartridge/models/totals');
            var totalsModel = new TotalsModel(basket);
            var orderSubTotal = parsePrice(totalsModel.subTotal);
            var cartDiscount = totalsModel.orderLevelDiscountTotal.value;
            if (cartDiscount !== 0) {
                orderSubTotal = (orderSubTotal - cartDiscount).toFixed(2);
            }
            return orderSubTotal;
            // eslint-disable-next-line no-else-return
        } else {
            return false;
        }
    }
};

module.exports = clearpayPreOrderTools;
