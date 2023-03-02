'use strict';

var orderCreateService = require('*/cartridge/scripts/order/expressOrderService');
var TokenModel = require('*/cartridge/scripts/models/clearpayTokenModel.js');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayExpressGetToken');

/**
 * calls token service to retrieve the token
 * @param {Object} basket - basket
 * @param {Object} checkoutPrice - Clearpay order value
 * @param {string} sourceUrl - source url
 * @param {string} merchantReference - merchantorder order
 * @param {Object} store - If store pickup
 * @returns {Object} - Token
 */
function getExpressToken(basket, checkoutPrice, sourceUrl, merchantReference, store) {
    try {
        orderCreateService.generateRequest(basket, checkoutPrice, sourceUrl, merchantReference, store);
        var response = orderCreateService.getResponse();
        if (!empty(response.token)) {
            var ClearpayToken = new TokenModel();
            Logger.debug('Clearpay Token generated from service: ' + response.token);
            ClearpayToken.cpToken = response.token;
            return ClearpayToken;
        }
        Logger.error('Can not get token. The response: ' + response);
        return response;
    } catch (exception) {
        Logger.error('Exception to get token: ' + exception);
        return {
            error: true,
            errorMessage: exception
        };
    }
}

/*
 * Module exports
 */
module.exports.getExpressToken = getExpressToken;
