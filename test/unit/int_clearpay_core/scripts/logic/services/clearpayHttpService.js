'use strict';

var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var loggerMock = require('../../../../../mocks/dw/system/Logger');

describe('clearpayService', function () {
    var clearpayServiceInit = require('../../../../../mocks/clearpay_mocks/clearpayService');

    var data = {
        request: {
            urlPath: 'orders',
            requestMethod: 'POST',
            basket: {}
        }
    };

    it('clearpayService should be initialized', function () {
        var service = clearpayServiceInit.getClearpayHttpService();
        var result = service.call("clearpay.http.defaultendpoint.US");
        assert.isNotNull(result);
        var responseData = service.getResponse();
        assert.isNotNull(responseData);
    });

    it('clearpayService createRequest is working', function () {
        var expectedOrderRequest = {
            expires: 'formatted date',
            token: 'authentication token'
        };
        var service = clearpayServiceInit.getClearpayHttpService();
        var result = service.call("clearpay.http.defaultendpoint.US");
    });

    it('clearpayService createRequest is null', function () {
        var dataWithInvalidMethod = {
            urlPath: '/orders',
            requestMethod: 'POST',
            request: {}
        };
        var service = clearpayServiceInit.getClearpayHttpService();
        var resultWithInvalidMethod = service.call("clearpay.http.defaultendpoint.US");

    });

    it('clearpayService getRequestLogMessage and getResponseLogMessage are null if request and response are bad respectively', function () {
        var service = clearpayServiceInit.getClearpayHttpService();
        var result = service.call("clearpay.http.defaultendpoint.US");
    });
});