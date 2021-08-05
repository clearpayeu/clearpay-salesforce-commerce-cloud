'use strict';
/* global empty */

var Site = require('dw/system/Site');
var PaymentMgr = require('dw/order/PaymentMgr');
var URLUtils = require('dw/web/URLUtils');
var Locale = require('dw/util/Locale');

/**
 *  Site Preferences Utilities
 */
var sitePreferencesUtilities = {

    getRedirectConfirmUrl: function () {
        return URLUtils.https('ClearpayRedirect-HandleResponse').toString();
    },

    getRedirectCancelUrl: function () {
        return URLUtils.https('ClearpayRedirect-HandleResponse').toString();
    },

    getPaymentMode: function () {
        return Site.current.preferences.custom.apPaymentMode;
    },

    getControllerCartridgeName: function () {
        return Site.getCurrent().getCustomPreferenceValue('apControllerCartridgeName');
    },

    getCaptureTimeout: function () {
        return Site.getCurrent().getCustomPreferenceValue('apCaptureTimeout');
    },

    isClearpayEnabled: function () {
        return Site.getCurrent().getCustomPreferenceValue('enableClearpay') || false;
    },

    getBrandSettings: function () {
        return JSON.parse(Site.getCurrent().getCustomPreferenceValue('apBrandSettings'));
    }
};

/**
 *  Brand Utilities
 */
var brandUtilities = {
    initBrand: function (locale) {
        var currentLocale = Locale.getLocale(locale);
        var countryCode = currentLocale ? currentLocale.country.toUpperCase() : null;
        var storedCountryCode = this.getCountryCode();
        var brandSettings;
        var brandCountrySetting;
        var isGenerallyApplicable;

        if (countryCode && countryCode !== storedCountryCode) {
            brandSettings = sitePreferencesUtilities.getBrandSettings();

            this.setCountryCode(countryCode);

            if (brandSettings) {
                brandCountrySetting = brandSettings[countryCode];
                isGenerallyApplicable = sitePreferencesUtilities.isClearpayEnabled();

                if (brandCountrySetting && isGenerallyApplicable) {
                    this.setClearpayApplicable(true);
                    this.setBrand(brandCountrySetting.brand);
                } else {
                    this.setClearpayApplicable(false);
                    this.setBrand(null);
                }
            } else {
                this.setClearpayApplicable(false);
                this.setBrand(null);
            }
        } else if (!countryCode) {
            this.setCountryCode(countryCode);
            this.setClearpayApplicable(false);
            this.setBrand(null);
        }
    },
    isClearpayApplicable: function () {
        return session.privacy.clearpayApplicable;
    },
    getBrand: function () {
        return session.privacy.clearpayBrand;
    },
    getCountryCode: function () {
        return session.privacy.clearpayCountry;
    },
    setClearpayApplicable: function (isApplicable) {
        session.privacy.clearpayApplicable = isApplicable;
    },
    setBrand: function (brand) {
        session.privacy.clearpayBrand = brand;
    },
    setCountryCode: function (countryCode) {
        session.privacy.clearpayCountry = countryCode;
    },
    getBrandSettings: function (countryCode) {
        var brandSettings = sitePreferencesUtilities.getBrandSettings();

        return brandSettings[countryCode || this.getCountryCode()];
    },
    /**
     * @description Returns class specifically for current API version.
     * Basically it checks what is configured API version and returns module named like specified in parentModulePath, but from v1/v2 subfolders
     * e.g. if parentModulePath is "~/cartridge/scripts/order/orderRequestBuilder" and API version configured in apBrandSettings site preference is "2",
     * then function will require "~/cartridge/scripts/order/v2/orderRequestBuilder" module
     * @param {string} parentModulePath - path to an abstract class / parent module on which needed class is based
     * @returns {Function} - constructor of class implementing logic for current API version
     */
    getApiVersionDependentClass: function (parentModulePath) {
        var folders = parentModulePath.split('/');
        var classModuleName = folders.pop();
        var parentFolderPath = folders.join('/');
        var countryCode = this.getCountryCode();
        var brandSettings = this.getBrandSettings(countryCode);

        if (!brandSettings || !brandSettings.versionApi) {
            throw new Error((this.getBrand() || 'Afterpay/Clearpay') +
                ' API version is not defined. Please specify it in apBrandSettings site preference (versionApi property)');
        }

        return require(parentFolderPath + '/v' + brandSettings.versionApi + '/' + classModuleName);
    }
};

/**
 *  Checkout Utilities
 */
var checkoutUtilities = {
    getPaymentMethodName: function () {
        var brandMapping = require('*/cartridge/scripts/brandMapping');
        var BrandUtilities = brandUtilities;

        var brand = BrandUtilities.getBrand();
        var mapping = brandMapping[brand];

        if (mapping) {
            return mapping.paymentMethod;
        } else {
            return null;
        }
    },

    getPaymentMethod: function () {
        return PaymentMgr.getPaymentMethod(this.getPaymentMethodName());
    },

    getPaymentTransaction: function (lineItemCtnr) {
        var paymentInstrument = this.getPaymentInstrument(lineItemCtnr);
        return paymentInstrument ? paymentInstrument.getPaymentTransaction() : null;
    },

    getPaymentInstrument: function (lineItemCtnr) {
        return lineItemCtnr.getPaymentInstruments(this.getPaymentMethodName())[0];
    },

    getPaymentModeFromOrder: function (order) {
        if (empty(order)) {
            return null;
        }

        var paymentTransaction = this.getPaymentTransaction(order);
        return paymentTransaction.custom.apPaymentMode;
    },

    getPaymentMode: function (order) {
        var paymentMode = this.getPaymentModeFromOrder(order);
        if (empty(paymentMode)) {
            paymentMode = sitePreferencesUtilities.getPaymentMode().value;
        }
        return paymentMode;
    },

    getPaymentResponseCode: function (callResult) {
        var response = (callResult.errorMessage) ? callResult.errorMessage : callResult;

        // eslint-disable-next-line eqeqeq
        if (sitePreferencesUtilities.getPaymentMode() == 'AUTHORISE' && typeof response === 'object') {
            return response.status;
        }

        return response;
    }
};

module.exports = {
    sitePreferencesUtilities: sitePreferencesUtilities,
    checkoutUtilities: checkoutUtilities,
    brandUtilities: brandUtilities
};
