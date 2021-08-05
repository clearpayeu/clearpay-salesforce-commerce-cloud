'use strict';
var clearpayHttpService = require('*/cartridge/scripts/logic/services/clearpayHttpService');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayConfigurationService');

/**
 *  request and response definitions for service to retrieve threshold amounts
 */
var requestUrl = null;
var ConfigurationService = {
    generateRequest: function () {
        requestUrl = clearpayUtils.getEndpoint('getConfiguration');
    },
    getResponse: function () {
        var response;
        try {
            var service = clearpayHttpService.getClearpayHttpService();
            var result = service.call(requestUrl, { requestMethod: 'GET' });
            response = clearpayUtils.handleServiceResponses(requestUrl, 'GET_CONFIGURATION', result, { requestMethod: 'GET' });
        } catch (ex) {
            var exception = ex;
            Logger.error(exception.message);
        }
        return response;
    }
};

module.exports = ConfigurationService;
