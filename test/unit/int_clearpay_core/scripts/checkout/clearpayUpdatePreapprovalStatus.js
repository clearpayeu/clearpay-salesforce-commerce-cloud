'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var loggerMock = require('../../../../mocks/dw/system/Logger');

var transaction = {
    wrap: function (callBack) {
        return callBack.call();
    },
    begin: function () {
    },
    commit: function () {
    }
};

var stubPreapprovalModel = sinon.stub();
stubPreapprovalModel.returns({
    status: null,
    cpToken: null
});

var paymentTransaction = {
    custom: {
        cpInitialStatus: 'approved',
        cpToken: 'shjdjadgejdksbfcdjfgbdsnkc'
    }
}

var parameter = {
    status: 'some status',
    cpToken: 'shjdjadgejdksbfcdjfgbdsnkc'
}

var utilitiesMock = {
    checkoutUtilities: {
        getPaymentTransaction: function () {
            return paymentTransaction;
        }
    }
};

var lineItemCtnrStub = {
    paymentInstruments: [{
        paymentMethod: {
            equals: function (value) {
                return value === 'CLEARPAY';
            },
            value: 'CLEARPAY'
        },
        paymentTransaction: {
            transactionID: '11148651345',
            amount: {value: 100}
        }
    }]
};

describe('clearpayUpdatePreapprovalStatus', function () {

    var clearpayUpdatePreapprovalStatus = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus', {
        'dw/system/Transaction': transaction,
        '*/cartridge/scripts/models/preapprovalModel': stubPreapprovalModel,
        '*/cartridge/scripts/util/clearpayUtilities': utilitiesMock,
        'dw/system/Logger': loggerMock
    });

    describe('#parsePreapprovalResult()', function () {
        it('parse preapproval status', function () {
            var result = clearpayUpdatePreapprovalStatus.parsePreapprovalResult(parameter);
            expect(result).to.be.object;
        });
    });

    describe('#updatePreapprovalStatus()', function () {
        it('update pre approval status', function () {
            stubPreapprovalModel.returns({
                status: 'some status',
                cpToken: 'shjdjadgejdksbfcdjfgbdsnkc'
            });

            var result = clearpayUpdatePreapprovalStatus.updatePreapprovalStatus(stubPreapprovalModel, lineItemCtnrStub);
            expect(result).to.be.object;
        });
    });

    describe('#getPreApprovalResult()', function () {
        it('get pre approval status', function () {
            var empty = sinon.stub();
            empty = function () {
                return false;
            }

            var result = clearpayUpdatePreapprovalStatus.getPreApprovalResult(lineItemCtnrStub, parameter);
            expect(result).to.be.object;
        });
    });
});
