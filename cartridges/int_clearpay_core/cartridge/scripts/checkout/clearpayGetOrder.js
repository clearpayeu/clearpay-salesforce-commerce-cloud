/**
 *
 * @input Basket : dw.order.Basket The basket to create shipments for
 * @output ClearpayToken : Object
 */
var getOrderService = require('*/cartridge/scripts/logic/services/clearpayGetOrderService');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayGetToken');

function getOrder(token) {
    try {
        getOrderService.generateRequest(token);

        var response = getOrderService.getResponse();

        if (!response || !response.token) {
            Logger.error('Can not get order. The response: ' + response);

            return {
                error: true,
                errorMessage: 'Could not retrieve order details from Clearpay'
            };
        }
        Logger.debug('Clearpay order returned from service: ' + response);
        return response;
    } catch (exception) {
        Logger.error('Exception to get order: ' + exception);
        return {
            error: true,
            errorMessage: exception
        };
    }
}


/*
 * Module exports
 */
module.exports = {
    GetOrder: function (token) {
        return getOrder(token);
    }
};
