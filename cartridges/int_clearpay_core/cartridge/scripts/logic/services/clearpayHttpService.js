'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var clearpayUtils = require('*/cartridge/scripts/util/clearpayUtils');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayHttpService');
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');

/**
 * generic method  to process  all service type requests and responses
 */

/**
 * Gets service id
 * @returns {string} - service id
 * */
function getServiceID() {
    var BrandUtilities = ClearpayUtilities.brandUtilities;
    var countryCode = BrandUtilities.getCountryCode();
    var brandSettings = BrandUtilities.getBrandSettings(countryCode);
    var serviceID;

    if (!brandSettings) {
        throw new Error('No HTTP service defined for identifier - ' + serviceID);
    } else {
        serviceID = brandSettings.service;
    }

    return serviceID;
}

/**
 * Provides differernt request - response services
 * @returns {Object} - object
 * */
function getClearpayHttpService() {
    var serviceID = getServiceID();

    var clearpayHttpService = LocalServiceRegistry.createService(serviceID, {
        createRequest: function (service, endPointUrl, requestBody) {
            var cpSitePreferencesUtilities = ClearpayUtilities.sitePreferencesUtilities;

            service.setURL(service.configuration.credential.URL + endPointUrl);
            service.setRequestMethod(requestBody.requestMethod);
            service.addHeader('Content-Type', 'application/json');

            var clearpayCartridge = 'ClearpayCartridge/23.3.0';
            var merchantID = service.configuration.credential.user;
            var siteURL = URLUtils.httpsHome().toString();
            var storeFront = Site.getCurrent().getID();
            var hostURL = siteURL.substring(0, siteURL.indexOf('/', 14));
            var compatibilityMode = dw.system.System.getCompatibilityMode();
            var storefrontVersion = '';
            if (storeFront.indexOf('SiteGenesis') >= 0) {
                storefrontVersion = Resource.msg('revisioninfo.revisionnumber', 'revisioninfo', null);
            } else if (storeFront.indexOf('RefArch') >= 0) {
                storefrontVersion = Resource.msg('global.version.number', 'version', null);
            }

            var uaAdditionalInfo = [
                'SalesforceCommerceCloud',
                storeFront + '/' + storefrontVersion,
                'CompatibilityMode/' + compatibilityMode,
                'Merchant/' + merchantID,
                'CashAppEnabled/0'
            ].join('; ');

            var userAgent = [
                clearpayCartridge,
                '(' + uaAdditionalInfo + ')',
                hostURL
            ].join(' ');

            service.addHeader('User-Agent', userAgent);

            if (endPointUrl === 'payments/capture') {
                service.timeout = cpSitePreferencesUtilities.getCaptureTimeout();
            }

            return JSON.stringify(requestBody);
        },

        parseResponse: function (service, httpClient) {
            if (httpClient.statusCode === 200 || httpClient.statusCode === 201 || httpClient.statusCode === 202) {
                var parseResponse = httpClient.text;
                var filterResponse = parseResponse;
                Logger.debug('Parsed Response : ' + clearpayUtils.filterLogData(filterResponse));
                return parseResponse;
            }
            Logger.error('Error on Clearpay request processing : ' + httpClient.statusCode);
            return httpClient;
        },

        getRequestLogMessage: function (request) {
            return clearpayUtils.filterLogData(request);
        },

        getResponseLogMessage: function (response) {
            return clearpayUtils.filterLogData(response.text);
        }
    });

    return clearpayHttpService;
}

module.exports = {
    getClearpayHttpService: getClearpayHttpService
};
