'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var clearpayServiceHandler = {
    data: {},
    configObj: {},
    client: {
        text: '{"success":true,"message":"success"}'
    },
    mock: false,
    request: {}
};

var service = {
    configuration: {
        credential: {
            URL: 'URL'
        }
    },
    URL: null,
    headers: [],
    method: 'POST',
    addHeader: function (key, value) {
        this.headers[key] = value;
    },
    setRequestMethod: function (method) {
        this.method = method;
    },
    setURL: function (url) {
        this.configuration.credential.URL = url;
        this.URL = url;
    }
};

var stringUtilsMock = {
    format: function (format, args) {
        var formattedString = format + args;
        return formattedString;
    }
};


var customLogger = {
    getLogger: function() {
	return Logger;
	}
};

var Logger = {
	debug: function() {},
	error: function() {},
};

var utilitiesMock = {
    clearpaySitePreferencesUtilities: function () {
        return {
            getUserAgent: function () { return {}; },
            getCaptureTimeout: function () { return {}; },
            getServiceName: function () { return 'clearpay_service_id'; }
        };
    }
};

var clearpayUtilities = {
    brandUtilities: {
        getCountryCode: function () {
            return 'US';
        },
        getBrandSettings: function () {
            return {
                service: 'clearpay.service.USCA'
            }
        }
    },
    sitePreferencesUtilities: {
        getServiceName: function () { return 'clearpay_service_id'; },
        getUserAgent: function () { return {}; },
        getCaptureTimeout: function () { return {}; },
    }
};

function proxyModel() {
    return proxyquire('../../../cartridges/int_clearpay_core/cartridge/scripts/logic/services/clearpayHttpService',
        {
            'dw/svc/LocalServiceRegistry': {
                createService: function (serviceId, configObj) {
                    return {
                        call: function (data) {
                            clearpayServiceHandler.configObj = configObj;
                            clearpayServiceHandler.data = data;
                           
                            var isOk = true;
                            var statusCheck = true;
                            return {
                                ok: isOk,
                                object: {
                                    status: isOk && statusCheck ? 'SUCCESS' : 'ERROR'
                                },
                                error: isOk ? 200 : 400
                            };
                        },
                        setMock: function () {
                            clearpayServiceHandler.mock = true;
                        },
                        getConfiguration: function () {
                            return clearpayServiceHandler.configObj;
                        },
                        getRequestData: function () {
                            clearpayServiceHandler.request = clearpayServiceHandler.configObj.createRequest(service);
                            return clearpayServiceHandler.request;
                        },
                        getResponse: function () {
                            return clearpayServiceHandler.mock
                                ? clearpayServiceHandler.configObj.mockCall(svc)
                                : clearpayServiceHandler.configObj.parseResponse(service, clearpayServiceHandler.client);
                        },
                        getCredentialID: function () {
                            return serviceId;
                        },
                        getMessage: function (response) {
                            return {
                                logMessage: clearpayServiceHandler.configObj.filterLogMessage('header test message'),
                                requestData: clearpayServiceHandler.configObj.getRequestLogMessage(clearpayServiceHandler.request),
                                logResponse: clearpayServiceHandler.configObj.getResponseLogMessage(response)
                            };
                        },
                        getErrorMessage: function (response) {
                            var obj = {};
                            obj.a = { b: obj };
                            return {
                                logMessage: clearpayServiceHandler.configObj.filterLogMessage('header test message'),
                                requestData: clearpayServiceHandler.configObj.getRequestLogMessage(obj),
                                logResponse: clearpayServiceHandler.configObj.getResponseLogMessage(response)
                            };
                        }
                    };
                }
            },
            '*/cartridge/scripts/util/clearpayUtils' : {
                        filterRequestForLog: function () {
                            return {};
                        }
                    },
            '*/cartridge/scripts/util/clearpayUtilities' : clearpayUtilities,
            'dw/util/StringUtils' : stringUtilsMock,
            '*/cartridge/scripts/util/clearpayLogUtils' : customLogger
        });
}

module.exports = proxyModel();