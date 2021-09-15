'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var BasketMgr = require('../../../../mocks/dw/order/BasketMgr');
var SiteMock = require('../../../../mocks/dw/system/Site');
var StringUtilsMock = require('../../../../mocks/util/StringUtils');

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

var siteMock = {
    getCurrent: function () {
        return {
            getCustomPreferenceValue: function () {
                return {
                    value: 'enableClearpay'
                };
            }
        };
    }
};

var basketObject = {
    totalGrossPrice: '200.00'
};


var requestJSON = {

    shippingAddress: {
        firstName: 'David',
        lastName: 'Johnson',
        address1: '25 Quincy Rd.',
        address2: '',
        city: 'Boston',
        postalCode: '01234',
        countryCode: {value: 'us'},
        phone: '617-777-1010',
        stateCode: 'MA',
    },
    billingAddress: {
        firstName: 'David',
        lastName: 'Johnson',
        address1: '25 Quincy Rd.',
        address2: '',
        city: 'Boston',
        postalCode: '01234',
        countryCode: {value: 'us'},
        phone: '617-777-1010',
        stateCode: 'MA',
    },
    customer: {
        email: 'test@gmail.com'
    }


};


describe('clearpayUtils', function () {

    var clearpayUtils = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/util/clearpayUtils.js', {
        'dw/web/Resource': {
            msg: function () {
                return 'someString';
            }
        },
        'dw/system/Site': SiteMock,
        'dw/order/BasketMgr': BasketMgr,
        'dw/util/StringUtils': StringUtilsMock,
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger
    });

    describe('#maskDetail', function () {

        it('mask customer related shipping details', function () {
            var result = clearpayUtils.maskDetails(requestJSON);
        });
    });
});
