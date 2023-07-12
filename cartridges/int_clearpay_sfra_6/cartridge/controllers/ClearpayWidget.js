'use strict';

/* API Includes */
var Money = require('dw/value/Money');
var BasketMgr = require('dw/order/BasketMgr');

/* Script Modules */
var server = require('server');
var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpBrandUtilities = cpUtilities.brandUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

server.get('IncludeClearpayLibrary', server.middleware.https, server.middleware.include, function (req, res, next) {
    var scope = {
        isClearpayEnabled: cpUtilities.sitePreferencesUtilities.isClearpayEnabled()
    };

    if (scope.isClearpayEnabled) {
        scope.thresholdAmounts = thresholdUtilities.getThresholdAmounts(cpBrandUtilities.getBrand());
    }

    res.render('util/clearpayLibraryInclude', scope);
    next();
});

/**
 *  Retrieve Updated Clearpay widgets
 */
server.get('GetUpdatedWidget', server.middleware.https, function (req, res, next) {
    var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');
    var updatedTemplate = 'util/clearpayMessage';
    var priceContext;
    var totalPrice;

    var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
    var reqProductID = req.querystring.productID;
    var isWithinThreshold = ClearpayCOHelpers.isPDPBasketAmountWithinThreshold();

    var currencyCode = req.session.currency.currencyCode;
    var cpEligible = cpBrandUtilities.isClearpayApplicable();

    if (req.querystring.className === 'pdp-clearpay-message') {
        totalPrice = req.querystring.updatedPrice;
        if (!empty(totalPrice)) {
            totalPrice = new Money(totalPrice, currencyCode);
        }
        reqProductID = req.querystring.productID;
        cpEligible = !ClearpayCOHelpers.checkRestrictedProducts(reqProductID);
    } else if (req.querystring.className === 'cart-clearpay-message') {
        var currentBasket = BasketMgr.getCurrentBasket();
        totalPrice = currentBasket.totalGrossPrice;
        cpEligible = !ClearpayCOHelpers.checkRestrictedCart();
    }

    priceContext = {
        classname: req.querystring.className,
        totalprice: totalPrice.value ? totalPrice.value : totalPrice,
        brand: cpBrandUtilities.getBrand(),
        eligible: cpEligible
    };

    var updatedWidget = renderTemplateHelper.getRenderedHtml(
        priceContext,
        updatedTemplate
    );

    var clearpayLimits = thresholdUtilities.checkThreshold(totalPrice);

    res.json({
        cpApplicable: (isWithinThreshold && clearpayLimits.status) && cpEligible,
        error: false,
        updatedWidget: updatedWidget
    });

    next();
});

module.exports = server.exports();
