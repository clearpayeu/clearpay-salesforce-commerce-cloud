'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var ArrayList = require('../../../../../../mocks/dw/util/Collection.js');
var collections = require('../../../../../../mocks/clearpayCollections');

function MockBasket() {
}

MockBasket.prototype.getPaymentInstruments = function () {
    return new ArrayList([null, null, null]);
};

MockBasket.prototype.removePaymentInstrument = function () {
    return true;
};

MockBasket.prototype.createPaymentInstrument = function () {
    return {
        paymentMethod: "CLEARPAY",
        paymentTransaction:
            {
                amount: {
                    value: "300.00"
                }
            }
    };
};

var transaction = {
    wrap: function (callBack) {
        return callBack.call();
    },
    begin: function () {
    },
    commit: function () {
    }
};

var item = {
    paymentMethod: "CREDIT_CARD",
    paymentTransaction:
        {
            amount: {
                value: "300.00"
            }
        }
};

var clearpayUtilities = {
    checkoutUtilities: {
        getPaymentMethodName: function () {
            return 'CLEARPAY';
        }
    }
};

describe('clearpay_credit', function () {
    describe('#Handle', function () {
        it('handle clearpay payment processor', function () {
            var currentBasket = new MockBasket();


            var clearpayCredit = proxyquire('../../../../../../../cartridges/int_clearpay_sfra/cartridge/scripts/hooks/payment/processor/clearpay_credit.js', {
                '*/cartridge/scripts/util/collections': collections,
                '*/cartridge/scripts/util/clearpayUtilities': clearpayUtilities,
                'dw/system/Transaction': transaction
            });

            var result = clearpayCredit.Handle(currentBasket);
            expect(result).to.be.an('object');
        });
    });
});
