'use strict';

var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

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
    handleServiceResponses: function () {
        return {};
    },
    getEndpoint: function () {
        return "some url";
    },

};

describe('#DirectCapturePaymentService()', function () {
    var clearpayDirectCapturePaymentService = proxyquire('../../../../../../cartridges/int_clearpay_core/cartridge/scripts/logic/services/clearpayDirectCapturePaymentService.js', {
        '*/cartridge/scripts/logic/services/clearpayHttpService': clearpayHttpServiceMock,
        '*/cartridge/scripts/util/clearpayUtils': clearpayUtils
    });

    var token = 'M2QwZTQxZDJmOTYyMjc', orderNo = "2134234";
    it('generated direct capture service request successfully', function () {
        var result = clearpayDirectCapturePaymentService.generateRequest(token, orderNo);
        expect(result).to.be.object;

    });

    it('generated direct capture response successfully', function () {
        var result = clearpayDirectCapturePaymentService.getResponse(token);
        expect(result).to.be.object;

    });
});
