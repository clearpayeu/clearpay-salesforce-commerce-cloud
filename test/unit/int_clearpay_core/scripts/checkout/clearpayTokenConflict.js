'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var ArrayList = require('../../../../mocks/dw.util.Collection');
var BasketMgr = require('../../../../mocks/dw/order/BasketMgr');
var collections = require('../../../../mocks/clearpayCollections');

var mockOptions = [{
    optionId: 'option 1',
    selectedValueId: '123'
}];

var availabilityModelMock = {
    inventoryRecord: {
        ATS: {
            value: 3
        }
    }
};

var productLineItemMock = {
    productID: 'someProductID',
    quantity: {
        value: 1
    },
    setQuantityValue: function () {
        return;
    },
    quantityValue: 1,
    product: {
        availabilityModel: availabilityModelMock
    },
    optionProductLineItems: new ArrayList(mockOptions),
    bundledProductLineItems: new ArrayList([])
};

var createApiBasket = function (productInBasket) {
    var basket = {
        defaultShipment: {},
        createProductLineItem: function () {
            return {
                setQuantityValue: function () {
                    return;
                }
            };
        }
    };
    if (productInBasket) {
        basket.productLineItems = new ArrayList([productLineItemMock]);
    } else {
        basket.productLineItems = new ArrayList([]);
    }

    return basket;
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

var token = 'jhdfdfbcnuiefhw';
describe('#clearpayTokenConflict', function (done) {

    var clearpayTokenConflict = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/checkout/clearpayTokenConflict', {
        '*/cartridge/scripts/util/getOrderToken': {
            validateOrderToken: function () {
                return {};
            }
        },
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger,
        '*/cartridge/scripts/util/collections': collections,
        'dw/util/ArrayList': ArrayList
    });

    it('remove bundled items from basket', function () {
        var basket = createApiBasket(false);
        var result = clearpayTokenConflict.removeBundledItems(basket);
        expect(result).to.be.object;
    });

    it('check token conflict', function () {
        var basket = createApiBasket(false);
        var result = clearpayTokenConflict.checkTokenConflict(basket, token);
        expect(result).to.be.boolean;
    });
});
