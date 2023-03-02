'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var clearpayConstants = require('../../../../../cartridges/int_clearpay_core/cartridge/scripts/util/clearpayConstants');

var transaction = {
    wrap: function (callBack) {
        return callBack.call();
    },
    begin: function () {
    },
    commit: function () {
    }
};

var order = {
    paymentInstruments: [
        {
            paymentMethod: {
                equals: function (value) {
                    return value === 'CLEARPAY';
                },
                value: 'CLEARPAY'
            }
        }]
};

var paymentStatus = {
    status: 'some status'
};

var utilitiesMock = {
    getSitePreferencesUtilities: function () {
        return {
            getPaymentMode: function () {
                return 'CLEARPAY';
            }
        };
    }
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

describe('#clearpayHandlePaymentOrder()', function () {

    var clearpayHandlePaymentOrder = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/checkout/clearpayHandlePaymentOrder', {
        'dw/system/Transaction': transaction,
        '*/cartridge/scripts/checkout/clearpayUpdateOrder': {
            handleUpdateOrder: function () {
                return {};
            }
        },
        '*/cartridge/scripts/util/clearpayUtilities': utilitiesMock,
        '*/cartridge/scripts/logic/services/clearpayUpdateOrderService': {
            extend: function () {
                return {};
            }
        },
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger,
        '*/cartridge/scripts/util/clearpayConstants': clearpayConstants
    });

    it('get payment transaction details', function () {
        var result = clearpayHandlePaymentOrder.getPaymentStatus(order, paymentStatus);
        expect(result).to.be.object;
    });

});

