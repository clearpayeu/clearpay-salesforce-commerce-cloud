'use strict';

var StringUtils = require('dw/util/StringUtils');

var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');

/**
 *  request and response definitions for payment service type 'get payment'
 */
var paymentService = {
    generateRequest: function (token, paymentID) {
        var param = !empty(token) ? 'token:' + token : paymentID;
        var requestUrl = StringUtils.format(clearpayUtils.getEndpoint('getPayment'), param);
        return requestUrl;
    },

    getResponse: function (requestUrl) {
        var service = clearpayHttpService.getClearpayHttpService();
        var result = service.call(requestUrl, { requestMethod: 'GET' });
        var response = clearpayUtils.handleServiceResponses(requestUrl, 'GET_PAYMENT', result, { requestMethod: 'GET' });
        return response;
    }
};

module.exports = paymentService;
