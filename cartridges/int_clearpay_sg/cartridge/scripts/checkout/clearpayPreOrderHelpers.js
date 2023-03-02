'use strict';

var clearpayPreOrderTools = {
    getCartSubtotal: function (basket) {
        return basket.getAdjustedMerchandizeTotalNetPrice();
    }
};

module.exports = clearpayPreOrderTools;
