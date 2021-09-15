'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

var responseCode = {
    httpStatusCode: "402"
};

global.session = {
    privacy: {
        clearpayBrand: 'clearpay'
    }
};

describe('clearpayErrors', function () {

    it('handle error responses based on the httpstatus codes', function () {
        var clearpayErrors = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/util/clearpayErrors.js', {
            'dw/web/Resource': {
                msg: function () {
                    return 'someString';
                }
            }
        });

        var result = clearpayErrors.getErrorResponses(responseCode);
        expect(result).to.be.an('string');
    });
});
