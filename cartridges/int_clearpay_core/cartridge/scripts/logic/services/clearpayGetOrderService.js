'use strict';

var StringUtils = require('dw/util/StringUtils');

var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayGetOrderService');
/**
 *  request and response definitions for the service type 'get orders'
 */
var requestUrl = null;

var getOrderService = {
    generateRequest: function (token) {
        var param = token || '';
        requestUrl = StringUtils.format(clearpayUtils.getEndpoint('getOrders'), param);
    },

    getResponse: function () {
        var response;
        try {
            var service = clearpayHttpService.getClearpayHttpService();
            var result = service.call(requestUrl, { requestMethod: 'GET' });
            response = clearpayUtils.handleServiceResponses(requestUrl, 'GET_ORDERS', result, { requestMethod: 'GET' });
        } catch (ex) {
            var exception = ex;
            Logger.error(exception.message);
        }
        return response;
    }
};

module.exports = getOrderService;
