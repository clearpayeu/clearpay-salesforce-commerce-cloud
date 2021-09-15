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

function getClearpayHttpService() {
    var serviceID = getServiceID();

    var clearpayHttpService = LocalServiceRegistry.createService(serviceID, {
        createRequest: function (service, endPointUrl, requestBody) {
            var apSitePreferencesUtilities = ClearpayUtilities.sitePreferencesUtilities;

            service.setURL(service.configuration.credential.URL + endPointUrl);
            service.setRequestMethod(requestBody.requestMethod);
            service.addHeader('Content-Type', 'application/json');

            const clearpayCartridge = 'ClearpayCartridge/23.0.0';
            const merchantID = 'Merchant/' + service.configuration.credential.user;
            const siteURL = URLUtils.httpsHome().toString();
            const storeFront = Site.getCurrent().getID();
            const hostURL = siteURL.substring(0, siteURL.indexOf('/', 14));
            var storefrontVersion = '';
            if (storeFront.includes('SiteGenesis')) {
                storefrontVersion = Resource.msg('revisioninfo.revisionnumber', 'revisioninfo', null);
            } else if (storeFront.includes('RefArch')) {
                storefrontVersion = Resource.msg('global.version.number', 'version', null);
            }

            var userAgent = clearpayCartridge + ' (SalesforceCommmerceCloud; ' + storeFront + '/' + storefrontVersion + '; ' + merchantID + ') ' + hostURL;

            service.addHeader('User-Agent', userAgent);

            if (endPointUrl === 'payments/capture') {
                service.timeout = apSitePreferencesUtilities.getCaptureTimeout();
            }

            return JSON.stringify(requestBody);
        },

        parseResponse: function (service, httpClient) {
            if (httpClient.statusCode === 200 || httpClient.statusCode === 201) {
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
