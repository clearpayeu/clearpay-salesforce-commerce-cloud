'use strict';

/* API Includes */
var Money = require('dw/value/Money');
var BasketMgr = require('dw/order/BasketMgr');

/* Script Modules */
var server = require('server');
var apUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var apBrandUtilities = apUtilities.brandUtilities;
var thresholdUtilities = apBrandUtilities.getApiVersionDependentClass('*/cartridge/scripts/util/thresholdUtilities');

server.get('IncludeClearpayLibrary',
    server.middleware.https,
    server.middleware.include,
    function (req, res, next) {
        var scope = {
            isClearpayEnabled: apUtilities.sitePreferencesUtilities.isClearpayEnabled()
        };

        if (scope.isClearpayEnabled) {
            scope.thresholdAmounts = thresholdUtilities.getThresholdAmounts(apBrandUtilities.getBrand());
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
        var totalPrice = 0;

        if (req.querystring.className === 'cart-clearpay-message' || req.querystring.className === 'checkout-clearpay-message') {
            var basketObject = BasketMgr.getCurrentBasket();
            totalPrice = basketObject.totalGrossPrice;
        } else {
            var productID = req.querystring.productID;
            var currencyCode = req.session.currency.currencyCode;
            var productObject = ProductFactory.get({
                pid: productID
            });

            if (productObject.price.sales) {
                totalPrice = productObject.price.sales.value;
            } else if (productObject.price.list) {
                totalPrice = productObject.price.list.value;
            } else if (productObject.price.min.sales) {
                totalPrice = productObject.price.min.sales.value;
            } else if (productObject.price.min.list) {
                totalPrice = productObject.price.min.list.value;
            }

            if (!empty(totalPrice)) {
                totalPrice = new Money(totalPrice, currencyCode);
            }
        }

        priceContext = {
            classname: req.querystring.className,
            totalprice: totalPrice.value,
            brand: apBrandUtilities.getBrand()
        };

        var updatedWidget = renderTemplateHelper.getRenderedHtml(
            priceContext,
            updatedTemplate
        );

        var isWithinThreshold = thresholdUtilities.checkThreshold(totalPrice);

        res.json({
            apApplicable: apBrandUtilities.isClearpayApplicable() && isWithinThreshold.status,
            error: false,
            updatedWidget: updatedWidget
        });

        next();
    });


module.exports = server.exports();
