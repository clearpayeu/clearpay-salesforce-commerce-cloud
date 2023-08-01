'use strict';

/* API Includes */
var Money = require('dw/value/Money');

/* Script Modules */
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
var cpBrandUtilities = require('*/cartridge/scripts/util/clearpayUtilities').brandUtilities;

var priceContext = {};
var getTemplateSpecificWidget = {};

/**
 * @description Hide sensitive details like customer details on request for logging purpose
 * @param {string} productObject - product object
 * @param {string} className - widget specific classname
 * @param {string} currencyCode - ISO 4217 mnemonic currency code
 * @param {string} locale - locale, e.g. en_US
 * @returns {string} - request JSON
 */
getTemplateSpecificWidget.getWidgetData = function (productObject, className, currencyCode, locale) {
    var totalPrice = null;

    cpBrandUtilities.initBrand(locale);
    var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

    if (productObject.productType === 'set' && productObject.individualProducts) {
        getTemplateSpecificWidget.getWidgetDataForSet(productObject, className, currencyCode);
    } else {
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

        priceContext = {
            classname: className,
            totalPrice: totalPrice
        };

        var clearpayLimits = thresholdUtilities.checkThreshold(totalPrice);

        var isEligible = cpBrandUtilities.isClearpayApplicable();
        var isWithinThreshold = clearpayLimits.status;
        var reqProductID = productObject.id;

        if (reqProductID != null && ClearpayCOHelpers.checkRestrictedProducts(reqProductID)) {
            isEligible = false;
        }

        priceContext.cpEligible = isEligible;
        priceContext.cpMpid = clearpayLimits.mpid;
        priceContext.cpApplicable = isEligible && isWithinThreshold;
    }

    return priceContext;
};

getTemplateSpecificWidget.getWidgetDataForSet = function (productObject, className, currencyCode) {
    var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
    var totalPrice = null;
    if (productObject.productType === 'set') {
        for (var i = 0; i < productObject.individualProducts.length; i++) {
            var singleSetProduct = productObject.individualProducts[i];
            if (singleSetProduct.price.sales) {
                totalPrice = singleSetProduct.price.sales.value;
            } else if (singleSetProduct.price.list) {
                totalPrice = singleSetProduct.price.list.value;
            } else if (singleSetProduct.price.min.sales) {
                totalPrice = singleSetProduct.price.min.sales.value;
            } else if (singleSetProduct.price.min.list) {
                totalPrice = singleSetProduct.price.min.list.value;
            }

            if (!empty(totalPrice)) {
                totalPrice = new Money(totalPrice, currencyCode);
            }

            var clearpayWidgetData = {
                classname: className,
                quickview: false
            };

            var clearpayLimits = thresholdUtilities.checkThreshold(totalPrice);

            var isEligible = cpBrandUtilities.isClearpayApplicable();
            var reqProductID = singleSetProduct.id;

            if (reqProductID != null && ClearpayCOHelpers.checkRestrictedProducts(reqProductID)) {
                isEligible = false;
            }
            var isWithinThreshold = clearpayLimits.status;

            clearpayWidgetData.cpEligible = isEligible;
            clearpayWidgetData.cpMpid = clearpayLimits.mpid;
            clearpayWidgetData.cpApplicable = isEligible && isWithinThreshold;

            getTemplateSpecificWidget.pushWidgetDataToProduct(singleSetProduct, clearpayWidgetData);
        }
    }
};

getTemplateSpecificWidget.pushWidgetDataToProduct = function (singleSetProduct, clearpayWidgetData) {
    Object.keys(clearpayWidgetData).forEach(function (key) {
        var productObject = singleSetProduct;
        productObject[key] = clearpayWidgetData[key];
    });
};

/**
 * @description Hide sensitive details like customer details on request for logging purpose
 * @param {string} currentBasket - product object
 * @param {string} className - widget specific classname
 * @param {string} locale - locale, e.g. en_US
 * @returns {string} - request JSON
 */
getTemplateSpecificWidget.getCheckoutWidgetData = function (currentBasket, className, locale) {
    var cartProductExcluded = ClearpayCOHelpers.checkRestrictedCart();
    cpBrandUtilities.initBrand(locale);

    if (!currentBasket) {
        return priceContext;
    }

    var totalPrice = currentBasket.totalGrossPrice;

    var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

    priceContext.classname = className;
    priceContext.totalPrice = totalPrice.value;

    var clearpayLimits = thresholdUtilities.checkThreshold(totalPrice);
    var isEligible = cpBrandUtilities.isClearpayApplicable() && !cartProductExcluded;
    var isWithinThreshold = clearpayLimits.status;

    priceContext.cpEligible = isEligible;
    priceContext.cpApplicable = isEligible && isWithinThreshold;
    priceContext.cpMpid = clearpayLimits.mpid;

    return priceContext;
};

module.exports = getTemplateSpecificWidget;
