'use strict';

/* API Includes */
var Money = require('dw/value/Money');

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

    var AfterpayCOHelpers = require('*/cartridge/scripts/checkout/afterpayCheckoutHelpers');
    var isWithinThreshold = AfterpayCOHelpers.isPDPBasketAmountWithinThreshold();

    if (req.querystring.className === 'pdp-clearpay-message') {
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

    isWithinThreshold = isWithinThreshold && thresholdUtilities.checkPriceThreshold(priceContext.totalprice).status;

    res.json({
        cpApplicable: cpBrandUtilities.isClearpayApplicable(),
        withinThreshold: isWithinThreshold,
        error: false,
        updatedWidget: updatedWidget
    });

    next();
});

module.exports = server.exports();
