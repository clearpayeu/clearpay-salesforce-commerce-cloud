'use strict';

/* API Includes */
var Money = require('dw/value/Money');
var BasketMgr = require('dw/order/BasketMgr');

/* Script Modules */
var server = require('server');
var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpBrandUtilities = cpUtilities.brandUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

server.get('IncludeClearpayLibrary',
    server.middleware.https,
    server.middleware.include,
    function (req, res, next) {
        var scope = {
            isClearpayEnabled: cpUtilities.sitePreferencesUtilities.isClearpayEnabled()
        };

        if (scope.isClearpayEnabled) {
            scope.thresholdAmounts = thresholdUtilities.getThresholdAmounts(cpBrandUtilities.getBrand());
        }

        res.render('util/clearpayLibraryInclude', scope);
        next();
    }
);

/**
 *  Retrieve Updated Clearpay widgets
 */
server.get('GetUpdatedWidget',
    server.middleware.https,
    function (req, res, next) {
        var ProductFactory = require('*/cartridge/scripts/factories/product');
        var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

        var updatedTemplate = 'util/clearpayMessage';
        var priceContext;
        var totalPrice;

        if (req.querystring.className === 'cart-clearpay-message' || req.querystring.className === 'checkout-clearpay-message') {
            var basketObject = BasketMgr.getCurrentBasket();
            totalPrice = basketObject.totalGrossPrice;
        } else {
            var currencyCode = req.session.currency.currencyCode;
            totalPrice = req.querystring.updatedProductPrice;

            if (!empty(totalPrice)) {
                totalPrice = new Money(totalPrice, currencyCode);
            }
        }

        priceContext = {
            classname: req.querystring.className,
            totalprice: totalPrice.value,
            brand: cpBrandUtilities.getBrand()
        };

        var updatedWidget = renderTemplateHelper.getRenderedHtml(
            priceContext,
            updatedTemplate
        );

        var isWithinThreshold = thresholdUtilities.checkThreshold(totalPrice);

        res.json({
            cpApplicable: cpBrandUtilities.isClearpayApplicable() && isWithinThreshold.status,
            error: false,
            updatedWidget: updatedWidget
        });

        next();
    });


module.exports = server.exports();
