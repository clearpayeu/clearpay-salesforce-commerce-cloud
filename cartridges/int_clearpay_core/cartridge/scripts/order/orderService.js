'use strict';

var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');
var OrderRequestBuilder = require('*/cartridge/scripts/order/orderRequestBuilder');

/**
 *  request and response definitions for payment service type 'create orders'
 */
var requestUrl = null;
var requestBody = {};
var orderService = {
    generateRequest: function (lineItemCtnr) {
        requestUrl = clearpayUtils.getEndpoint('createOrders');
        this.generateRequestBody(lineItemCtnr);
    },

    getResponse: function () {
        var service = clearpayHttpService.getClearpayHttpService();
        var result = service.call(requestUrl, requestBody);
        var response = clearpayUtils.handleServiceResponses(requestUrl, 'CREATE_ORDER', result, { requestMethod: 'GET' });
        return response;
    },

    generateRequestBody: function (lineItemCtnr) {
        var orderRequestBuilder = new OrderRequestBuilder();
        requestBody = orderRequestBuilder.buildRequest({
            basket: lineItemCtnr,
            requestMethod: 'POST'
        }).get();
    }
};

module.exports = orderService;
