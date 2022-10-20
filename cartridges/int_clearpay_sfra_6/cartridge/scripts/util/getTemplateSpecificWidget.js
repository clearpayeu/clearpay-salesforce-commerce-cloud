'use strict';

/* API Includes */
var Money = require('dw/value/Money');

/* Script Modules */
var { brandUtilities: cpBrandUtilities, sitePreferencesUtilities:cpSitePreferences } = require('*/cartridge/scripts/util/clearpayUtilities');

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
    var priceContext;
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

        var isWithinThreshold = thresholdUtilities.checkThreshold(totalPrice);

        if (isWithinThreshold.belowThreshold) {
            priceContext.belowthreshold = isWithinThreshold.belowThreshold;
        }

        var isApplicable = cpBrandUtilities.isClearpayApplicable() && isWithinThreshold.status;
        var cpBrand = cpBrandUtilities.getBrand();

        priceContext.cpApplicable = isApplicable;
        priceContext.cpBrand = cpBrand;
    }

    return priceContext;
};

getTemplateSpecificWidget.getWidgetDataForSet = function (productObject, className, currencyCode) {
    var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
    var totalPrice = null;

    if (productObject.productType === 'set') {
        var clearpayWidgetData = {};
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

            clearpayWidgetData = {
                classname: className,
                quickview: false
            };

            var isWithinThreshold = thresholdUtilities.checkThreshold(totalPrice);

            if (isWithinThreshold.belowThreshold) {
                clearpayWidgetData.belowthreshold = isWithinThreshold.belowThreshold;
            }

            var isApplicable = cpBrandUtilities.isClearpayApplicable() && isWithinThreshold.status;
            var cpBrand = cpBrandUtilities.getBrand();

            clearpayWidgetData.cpApplicable = isApplicable;
            clearpayWidgetData.cpBrand = cpBrand;

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
    var priceContext = {};

    if (!currentBasket) {
        return priceContext;
    }

    var totalPrice = 0.0;

    totalPrice = currentBasket.totalGrossPrice;

    cpBrandUtilities.initBrand(locale);
    var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

    priceContext.classname = className;
    priceContext.totalPrice = totalPrice.value;

    var isWithinThreshold = thresholdUtilities.checkThreshold(totalPrice);

    if (isWithinThreshold.belowThreshold) {
        priceContext.belowthreshold = isWithinThreshold.belowThreshold;
        priceContext.minthresholdamount = isWithinThreshold.minThresholdAmount;
    }

    var isApplicable = cpBrandUtilities.isClearpayApplicable() && isWithinThreshold.status;
    var iscashAppApplicable = cpSitePreferences.isCashAppEnabled() && isWithinThreshold.status;
    var cpBrand = cpBrandUtilities.getBrand();

    if (className === 'checkout-clearpay-message') {
        isApplicable = isApplicable && !isWithinThreshold.belowThreshold;
    }

    priceContext.cpApplicable = isApplicable;
    priceContext.cashAppApplicable = iscashAppApplicable;
    priceContext.cpBrand = cpBrand;

    return priceContext;
};

module.exports = getTemplateSpecificWidget;
