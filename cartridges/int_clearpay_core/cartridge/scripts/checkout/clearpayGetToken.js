'use strict';

var orderCreateService = require('*/cartridge/scripts/order/orderService');
var TokenModel = require('*/cartridge/scripts/models/clearpayTokenModel.js');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayGetToken');
/**
 * calls token service to retrieve the token
 * @param {Object} basket - basket
 * @returns {Object} - Token
 */
function getToken(basket) {
    var ClearpayToken;
    try {
        orderCreateService.generateRequest(basket);
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

module.exports.getToken = getToken;
