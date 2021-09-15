'use strict';

var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var clearpayHttpServiceMock = {
    call: function () {
        return {};
    }
};

var clearpayUtils = {
    handleServiceResponses: function () {
        return {};
    },
    getEndpoint: function () {
        return "some url";
    },

};

var customLogger = {
    getLogger: function () {
        return Logger;
    }
};

var Logger = {
    debug: function () {
    },
    error: function () {
    },
};

describe('#ConfigurationService()', function () {
    var clearpayConfigurationService = proxyquire('../../../../../../cartridges/int_clearpay_core/cartridge/scripts/logic/services/clearpayConfigurationService.js', {
        '*/cartridge/scripts/logic/services/clearpayHttpService': clearpayHttpServiceMock,
        '*/cartridge/scripts/util/clearpayUtils': clearpayUtils,
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger
    });

    var token = 'M2QwZTQxZDJmOTYyMjc', orderNo = "2134234";
    it('generated configuration service request successfully', function () {
        var result = clearpayConfigurationService.generateRequest();
        expect(result).to.be.object;

    });

    it('generated configuration response successfully', function () {
        var result = clearpayConfigurationService.getResponse();
        expect(result).to.be.object;

    });
});