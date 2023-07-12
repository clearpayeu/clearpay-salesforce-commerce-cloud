'use strict';

var server = require('server');

var Cart = module.superModule;
server.extend(Cart);

/**
* prepends Cart-Show method to show clearpay widget
*/
server.append(
    'Show',
    server.middleware.https,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var priceContext = require('*/cartridge/scripts/util/getTemplateSpecificWidget').getCheckoutWidgetData(
            currentBasket,
            'cart-clearpay-message',
            req.locale.id
        );

        res.setViewData(priceContext);
        next();
    }
);

module.exports = server.exports();
