'use strict';

var server = require('server');

var Product = module.superModule;
server.extend(Product);

var setClearpayMessageContext = function (req, res, next) {
    var productTileParams = res.getViewData();
    var priceContext;

    priceContext = require('*/cartridge/scripts/util/getTemplateSpecificWidget').getWidgetData(
        productTileParams.product,
        'pdp-clearpay-message',
        req.session.currency.currencyCode,
        req.locale.id
    );

    res.setViewData(priceContext);
    next();
};

/**
* prepends Product-Show method to show clearpay widget
*/
server.append('Show', setClearpayMessageContext);

server.append('ShowQuickView', setClearpayMessageContext);

/**
* appends Product-Variation method to to retrieve the selected variation
*/
server.append('Variation', function (req, res, next) {
    var params = req.querystring;
    var variationSelected = false;
    if (params.variables && params.variables.color && !empty(params.variables.color.value)) {
        variationSelected = true;
    }
    res.json({
        variationSelected: variationSelected
    });

    next();
});

server.get('IncludeClearpayMessage',
    server.middleware.include,
    function (req, res, next) {
        var ProductFactory = require('*/cartridge/scripts/factories/product');
        res.setViewData({
            product: ProductFactory.get(req.querystring)
        });
        next();
    },
    setClearpayMessageContext,
    function (req, res, next) {
        res.render('util/clearpayMessageInclude');
        next();
    });

module.exports = server.exports();
