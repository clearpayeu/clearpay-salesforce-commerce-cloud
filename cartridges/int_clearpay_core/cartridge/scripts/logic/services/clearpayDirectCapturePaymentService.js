'use strict';
var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');

/**
 *  request and response definitions for payment service type 'direct capture'
 */
var DirectCapturePaymentService = {
    generateRequest: function (token, orderNo) {
        var requestUrl = clearpayUtils.getEndpoint('directCapturePayment');
        var requestBody = this.generateRequestBody(token, orderNo);
        return {
            requestBody: requestBody,
            requestUrl: requestUrl
        };
    },

    getResponse: function (requestUrl, requestBody) {
        var service = clearpayHttpService.getClearpayHttpService();
        var result = service.call(requestUrl, requestBody);
        var response = clearpayUtils.handleServiceResponses(requestUrl, 'DIRECT_CAPTURE_PAYMENT', result, requestBody);
        return response;
    },

    generateRequestBody: function (token, orderNo) {
        var requestBody = {
            token: token,
            merchantReference: orderNo,
            requestMethod: 'POST'
        };
        return requestBody;
    }
};

module.exports = DirectCapturePaymentService;
