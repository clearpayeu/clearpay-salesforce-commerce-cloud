'use strict';

var assert = require('chai').assert;
var expect = require('chai').expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var StringUtilsMock = require('../../../../../mocks/util/StringUtils');

var clearpayHttpServiceMock = {
    getClearpayHttpService: function () {
        return {
            call: function () {
                return {};
            }
        }
    }
};

var clearpayUtils = {
    getOrders: function () {
        return "orders/{0}";
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
describe('#getOrderService()', function () {
    var clearpayGetOrderService = proxyquire('../../../../../../cartridges/int_clearpay_core/cartridge/scripts/logic/services/clearpayGetOrderService.js', {
        'dw/util/StringUtils': StringUtilsMock,
        '*/cartridge/scripts/logic/services/clearpayHttpService': clearpayHttpServiceMock,
        '*/cartridge/scripts/util/clearpayUtils': clearpayUtils,
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger
    });


    var token = 'M2QwZTQxZDJmOTYyMjc';
    it('generated getOrder service request successfully', function () {
        var result = clearpayGetOrderService.generateRequest(token);
        expect(result).to.be.object;

    });

    it('generated getOrder service response successfully', function () {
        var result = clearpayGetOrderService.getResponse(token);
        expect(result).to.be.object;
    });
});