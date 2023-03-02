'use strict';

var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');

/**
 *  request and response definitions for payment service type 'authorise'
 */
var AuthorisePaymentService = {
    generateRequest: function (order, token, orderNo, amount, expressCheckoutModel) {
        var requestUrl = clearpayUtils.getEndpoint('authorise');
        var requestBody = null;

        if (expressCheckoutModel && expressCheckoutModel.cpExpressCheckout) {
            // check the session state:
            var shippingObj = null;
            var itemsObj = null;
            var isCheckoutAdjusted = false;
            var CaptureHelpers = require('*/cartridge/scripts/payment/expressCaptureHelpers');
            var body = CaptureHelpers.generateItemsAndShippingBody(order);
            if (expressCheckoutModel.cpTempShippingAddressChanged) {
                shippingObj = body.shipping;
                isCheckoutAdjusted = true;
            }
            if (expressCheckoutModel.cpTempBasketItemsChanged) {
                itemsObj = body.items;
                isCheckoutAdjusted = true;
            }
            // Possibly account for coupons, or possibly other factors
            if (expressCheckoutModel.cpTempCheckoutAmountChanged) {
                isCheckoutAdjusted = true;
            }
            // express checkout has 2 types of capture. One is with the Clearpay widget (has checksum)
            // and one does not (usually BuyNow)
            if (expressCheckoutModel.cpExpressCheckoutChecksum) {
                requestBody = this.generateRequestBodyExpressCheckoutWithChecksum(token, orderNo,
                    amount, expressCheckoutModel.cpExpressCheckoutChecksum, itemsObj, shippingObj, isCheckoutAdjusted);
            } else {
                requestBody = this.generateRequestBodyExpressCheckout(token, orderNo, amount);
            }
        } else {
            requestBody = this.generateRequestBody(token, orderNo);
        }
        return {
            requestBody: requestBody,
            requestUrl: requestUrl
        };
    },

    getResponse: function (requestUrl, requestBody) {
        var service = clearpayHttpService.getClearpayHttpService();
        var result = service.call(requestUrl, requestBody);
        var response = clearpayUtils.handleServiceResponses(requestUrl, 'AUTHORISE_PAYMENT', result, requestBody);
        return response;
    },

    generateRequestBody: function (token, orderNo) {
        var requestBody = {
            token: token,
            merchantReference: orderNo,
            requestMethod: 'POST'
        };
        return requestBody;
    },

    generateRequestBodyExpressCheckout: function (token, orderNo, amount) {
        var requestBody = {
            token: token,
            merchantReference: orderNo,
            requestMethod: 'POST',
            amount: { amount: amount.value, currency: amount.currencyCode }
        };
        return requestBody;
    },
    generateRequestBodyExpressCheckoutWithChecksum: function (token, orderNo, amount, checksum, itemsObj, shippingObj, isCheckoutAdjusted) {
        var requestBody = {
            token: token,
            merchantReference: orderNo,
            requestMethod: 'POST',
            isCheckoutAdjusted: isCheckoutAdjusted,
            amount: { amount: amount.value, currency: amount.currencyCode }
        };
        if (shippingObj) {
            requestBody.shipping = shippingObj;
        }
        if (itemsObj) {
            requestBody.items = itemsObj;
        }
        if (isCheckoutAdjusted || shippingObj || itemsObj) {
            requestBody.paymentScheduleChecksum = checksum;
        }
        return requestBody;
    }
};

module.exports = AuthorisePaymentService;
