'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var OrderMock = require('../../../../mocks/models/order');

var order = new OrderMock();

var transaction = {
    wrap: function (callBack) {
        return callBack.call();
    },
    begin: function () {
    },
    commit: function () {
    }
};

var customLogger = {
    getLogger: function () {
        return Logger;
    }
};

var statusMock = {};

var Logger = {
    debug: function () {
    }
};

var clearpayUtilities = {
    checkoutUtilities: {
        getPaymentMethodName: function () {
            return 'CLEARPAY';
        }
    }
};

beforeEach(function () {
    if (Logger.debug.restore) {
        Logger.debug.restore();
    }
});

describe('updatePaymentStatus', function () {

    describe('#handlePaymentStatus', function () {

        var updatePaymentStatus = proxyquire('../../../../../cartridges/int_clearpay_sfra/cartridge/scripts/checkout/updatePaymentStatus.js', {
            'dw/system/Transaction': transaction,
            'dw/order/Order': OrderMock,
            'dw/system/Status': statusMock,
            '*/cartridge/scripts/util/clearpayLogUtils': customLogger,
            '*/cartridge/scripts/util/clearpayUtilities': clearpayUtilities,
            '*/cartridge/scripts/checkout/clearpayHandlePaymentOrder': {
                getPaymentStatus: function () {
                    return {
                        finalPaymentStatus: 'some status'
                    };
                }
            },
            '*/cartridge/scripts/checkout/clearpayIdempotency': {
                DelayPayment: function () {
                    return {
                        paymentStatus: 'some status'
                    };
                }
            }
        });
        OrderMock.ORDER_STATUS_CREATED = 0;
        order.orderNo = '1234567';
        order.status = {};

        OrderMock = {
            paymentInstruments: [
                {

                    paymentMethod: {
                        equals: function (value) {
                            return value === 'CLEARPAY';
                        },
                        value: 'CLEARPAY'
                    },
                    paymentTransaction: {
                        transactionID: '11148651345',
                        amount: {value: 100},
                        custom: {
                            cpInitialStatus: "approved"
                        }
                    }
                }
            ]
        };
        it('when service is unavailable', function () {
            var result = updatePaymentStatus.handlePaymentStatus(OrderMock);
            expect(result).to.be.object;
        });
    });
});

