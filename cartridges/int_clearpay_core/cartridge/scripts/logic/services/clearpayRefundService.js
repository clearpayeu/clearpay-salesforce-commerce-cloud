var { brandUtilities } = require('*/cartridge/scripts/util/clearpayUtilities');
var Context = brandUtilities.getApiVersionDependentClass('*/cartridge/scripts/context/context');
var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var StringUtils = require('dw/util/StringUtils');

/**
 *  request and response definitions for payment service type 'refund'
 */
var RefundService = function () {
    // eslint-disable-next-line no-underscore-dangle
    this._requestUrl = null;
    // eslint-disable-next-line no-underscore-dangle
    this._requestBody = {};
    this.clearpayHttpService = clearpayHttpService.getClearpayHttpService();
    this.context = new Context();
};

RefundService.prototype = {
    constructor: RefundService,
    generateRequest: function (params) {
        var arg = params && params.paymentID ? params.paymentID : '';

        this._requestUrl = StringUtils.format(this.context.get('createRefund'), arg); // eslint-disable-line
        this._generateRequestBody(params); // eslint-disable-line
    },
    getResponse: function () {
        var response = this.clearpayHttpService.call(this._requestUrl, this._requestBody); // eslint-disable-line

        return response;
    },
    _generateRequestBody: function (params) {
        this._requestBody = { // eslint-disable-line
            amount: params.amount,
            merchantReference: params.orderNo,
            requestId: params.requestId,
            requestMethod: 'POST'
        };
    }
};

module.exports = RefundService;
