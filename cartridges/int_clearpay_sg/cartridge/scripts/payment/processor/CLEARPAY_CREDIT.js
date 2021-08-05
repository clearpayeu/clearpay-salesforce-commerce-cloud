'use strict';

/* Script Modules */
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('CLEARPAY_CREDIT');
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var BrandUtilities = ClearpayUtilities.brandUtilities;
var BrandMapping = require('*/cartridge/scripts/brandMapping');

/**
 * Calls  Handle of CLEARPAY
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Handle(args) {
    var brand = BrandUtilities.getBrand();
    var mapping = BrandMapping[brand];
    var processorPath = null;

    if (mapping) {
        processorPath = mapping.paymentProcessor;

        if (!processorPath) {
            return {
                error: true
            };
        }
    }

    var response = require(processorPath).Handle(args); // eslint-disable-line

    if (response.error) {
        return {
            error: true
        };
    }

    return {
        redirect: response.redirect,
        success: true
    };
}

/**
 * Calls  Authorize of CLEARPAY
 * @param {Object} args - arguments
 * @returns {Object} response - response
 */
function Authorize(args) {
    var brand = BrandUtilities.getBrand();
    var mapping = BrandMapping[brand];
    var processorPath = null;

    if (mapping) {
        processorPath = mapping.paymentProcessor;

        if (!processorPath) {
            return {
                error: true
            };
        }
    }

    var authorizationStatus = require(processorPath).Authorise(args); // eslint-disable-line

    Logger.debug('Authorization response in CLEARPAY_CREDIT: ' + JSON.stringify(authorizationStatus));

    if (authorizationStatus.authorized) {
        return { authorized: true };
    }

    return {
        authorizationResponse: authorizationStatus.ClearpayOrderErrorMessage,
        error: true
    };
}

/*
 * Local methods
 */
exports.Handle = Handle;
exports.Authorize = Authorize;
