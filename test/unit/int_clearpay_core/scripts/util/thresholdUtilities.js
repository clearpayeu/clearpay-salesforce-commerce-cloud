'use strict';
var assert = require('chai').assert;
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var loggerMock = require('../../../../mocks/dw/system/Logger');
var PaymentMgr = require('../../../../mocks/dw/order/PaymentMgr');

var PaymentMgrMock = {...PaymentMgr};
PaymentMgrMock.getPaymentMethod = function () {
    return {
        isApplicable: function () {
            return true;
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

var utilitiesMock = {
    brandUtilities: {
        getBrand: function () {
            return 'clearpay'
        },
        getCountryCode: function () {
            return 'US';
        },
        isClearpayApplicable: function () {
            return true;
        }
    },
    checkoutUtilities: {
        getPaymentMethodName: function () {
            return 'CLEARPAY';
        }
    },
    sitePreferencesUtilities: {
        getMinThresholdAmount: function () {
            return 100;
        },
        getMaxThresholdAmount: function () {
            return 1000;
        }
    }
};

var clearpayLogUtils = {
    getLogger: function () {
        return {
            debug: function () {
            }
        };
    }
}

var clearpayConfigurationServiceMock = {
    generateRequest: function () {
    },
    getResponse: function () {
        return {
            minimumAmount: {
                amount: 5
            },
            maximumAmount: {
                amount: 5
            }
        };
    }
};

var session = {
    privacy: {
        map: new Map(), // eslint-disable-line no-undef
        get: function (key) { // eslint-disable-line no-unused-vars
            return this.map.get(key);
        },
        set: function (key, value) { // eslint-disable-line no-unused-vars
            this.map.set(key, value);
        },
        key: ''
    },
    currency: {
        getCurrencyCode: function() {
        }
    }
};

global.session = session;

global.empty = function (value) {
    if (value && value.length) {
        return !value.length;
    }
    return !value;
};

global.request = {
    getLocale: function () {
        return 'en_US';
    }
}

describe('thresholdUtilities', function () {

    var thresholdUtilities = proxyquire('../../../../../cartridges/int_clearpay_core/cartridge/scripts/util/thresholdUtilities.js', {
        'dw/system/Transaction': transaction,
        'dw/order/PaymentMgr': PaymentMgrMock,
        '*/cartridge/scripts/util/clearpayUtilities': utilitiesMock,
        '*/cartridge/scripts/logic/services/clearpayConfigurationService': clearpayConfigurationServiceMock,
        '*/cartridge/scripts/util/clearpayLogUtils': customLogger
    });

    it('detect that provided price is within an actual threshold', function () {
        var clearPayIsRangeAvailable = session.privacy.set('clearPayIsRangeAvailable', true);
        var clearPayMinAmount = session.privacy.set('clearPayMinAmount', 100);
        var clearPayMaxAmount = session.privacy.set('clearPayMaxAmount', 1000);
        var result = thresholdUtilities.checkThreshold({
            value: 1
        });
        assert.equal(result.status, false);
    });
});
