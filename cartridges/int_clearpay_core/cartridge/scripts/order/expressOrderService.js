'use strict';

var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');
var OrderRequestBuilder = require('*/cartridge/scripts/order/expressOrderRequestBuilder');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('expressOrderService');

/**
 *  request and response definitions for payment service type 'create orders'
 */
var requestUrl = null;
var requestBody = {};
var expressOrderService = {
    generateRequest: function (basket, checkoutPrice, sourceUrl, merchantReference, store) {
        requestUrl = clearpayUtils.getEndpoint('createOrders');
        this.generateRequestBody(basket, checkoutPrice, sourceUrl, merchantReference, store);
    },

    getResponse: function () {
        var service = clearpayHttpService.getClearpayHttpService();
        var result = service.call(requestUrl, requestBody);
        Logger.debug('RequestBody: ' + JSON.stringify(requestBody));
        var response = clearpayUtils.handleServiceResponses(requestUrl, 'CREATE_ORDER', result, { requestMethod: 'GET' });
        Logger.debug('Response: ' + JSON.stringify(response));
        return response;
    },

    generateRequestBody: function (basket, checkoutPrice, sourceUrl, merchantReference, store) {
        var orderRequestBuilder = new OrderRequestBuilder();
        requestBody = orderRequestBuilder.buildRequest({
            basket: basket,
            checkoutPrice: checkoutPrice,
            merchantReference: merchantReference,
            sourceUrl: sourceUrl,
            store: store,
            requestMethod: 'POST'
        }).get();
    }
};

module.exports = expressOrderService;
