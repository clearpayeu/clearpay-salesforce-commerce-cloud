'use strict';
/* global empty */
var orderCreateService = require('*/cartridge/scripts/order/expressOrderService');
var TokenModel = require('*/cartridge/scripts/models/clearpayTokenModel.js');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayExpressGetToken');

/**
 * calls token service to retrieve the token
 */
function getExpressToken(basket, checkoutPrice, sourceUrl, merchantReference, store) {
    var ClearpayToken;
    try {
        orderCreateService.generateRequest(basket, checkoutPrice, sourceUrl, merchantReference, store);

        var response = orderCreateService.getResponse();
        var res = new TokenModel();

        if (!empty(response.token)) {
            Logger.debug('Clearpay Token generated from service: ' + response.token);
            res.cpToken = response.token;

            ClearpayToken = res;
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
