'use strict';
var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var ArrayList = require('dw/util/ArrayList');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('clearpayCheckoutHelpers');

var checkoutTools = {
    // splits name into first/last
    splitName: function (singleName) {
        var firstName = singleName.split(' ').slice(0, -1).join(' ');
        var lastName = singleName.split(' ').slice(-1).join(' ');
        return {
            firstName: firstName,
            lastName: lastName
        };
    },
    // currently just strips the leading 1 if it exists
    stripUSPhoneNumberLeadingOne: function (phone) {
        // the current regex used by SiteGenesis is in validator.js (for north america)
        let regex = /^(1-?)(\(?([2-9][0-8][0-9])\)?[\-\. ]?([2-9][0-9]{2})[\-\. ]?([0-9]{4})(\s*x[0-9]+)?)$/;
        let found = phone.match(regex);
        if (found) {
            phone = found[2];
        }
        return phone;
    },
    addConsumerToBasket: function (basket, cpConsumer) {
        var Transaction = require('dw/system/Transaction');
        Transaction.wrap(function () {
            basket.setCustomerEmail(cpConsumer.email || '');
            basket.setCustomerName((cpConsumer.givenNames || '').trim() + ' ' + (cpConsumer.givenNames || '').trim());
        });
        // ignoring
        // cpConsumer.phoneNumber;
    },
    addBillingAddressToBasket: function (basket, cpBilling) {
        var Transaction = require('dw/system/Transaction');
        var billingAddress = basket.billingAddress;
        let name = this.splitName(cpBilling.name || '');
        let stripLeadingOne = this.stripUSPhoneNumberLeadingOne;

        Transaction.wrap(function () {
            if (!billingAddress) {
                billingAddress = basket.createBillingAddress();
            }

            billingAddress.setFirstName(name.firstName || '');
            billingAddress.setLastName(name.lastName || '');

            billingAddress.setAddress1(cpBilling.line1 || '');
            billingAddress.setAddress2(cpBilling.line2 || '');
            billingAddress.setCity(cpBilling.area1 || '');
            billingAddress.setPostalCode(cpBilling.postcode || '');
            billingAddress.setStateCode(cpBilling.region || '');
            billingAddress.setCountryCode(cpBilling.countryCode || '');
            if (cpBilling.countryCode.toUpperCase() === 'US') {
                billingAddress.setPhone(stripLeadingOne(cpBilling.phoneNumber || ''));
            } else {
                billingAddress.setPhone(cpBilling.phoneNumber || '');
            }
        });
    },
     // returns a Map with storeid's -> addresses. The "NONE" corresponds to
    // items which are not a store pickup
    getInStorePickupsMap: function (basket) {
        // let lineItems = cart.object.getProductLineItems();
        // let storeMap = new Map();
        var storeMap = {};
        let lineItemsIter = basket.allProductLineItems.iterator();
        while (lineItemsIter.hasNext()) {
            let lineItem = lineItemsIter.next();
            if (lineItem.custom.fromStoreId) {
                storeMap[lineItem.custom.fromStoreId] = dw.catalog.StoreMgr.getStore(lineItem.custom.fromStoreId);
            }
        }
        return storeMap;
    },
    getNumHomeDeliveries: function (basket) {
        let cnt = 0;
        let lineItemsIter = basket.allProductLineItems.iterator();
        while (lineItemsIter.hasNext()) {
            let lineItem = lineItemsIter.next();
            if (!lineItem.custom.fromStoreId) {
                ++cnt;
            }
        }
        return cnt;
    },
    getCurrentClearpayPaymentAmount: function (basket) {
        // Just gets the amount currently associated with the Clearpay payment instrument
        var paymentMethod = cpCheckoutUtilities.getPaymentMethodName();
        let pi = basket.getPaymentInstruments(paymentMethod);
        if (pi.length == 0) {
            return new dw.value.Money(0.0, basket.currencyCode);
        }
        let payment = pi[0].getPaymentTransaction();
        if (!payment) {
            return new dw.value.Money(0.0, basket.currencyCode);
        }
        return payment.amount;
    },
    // compute a checksum for the current items in the basket so we can check
    // if anything changed
    computeBasketProductLineItemChecksum: function (ctnr) {
        let crc32 = cpUtilities.crc32;
        // Should use whatever info we use in building the create checkout
        var lineItems = ctnr.getAllProductLineItems().toArray();
        // let product = li.product;
        let cksum = 0;

        lineItems.map(function (li) {
            let product = li.product;
            // just ignore names. Using quantity/productid/price/currency
            // product can be null if line-item is something like a warranty. Just ignoring those.
            let cc = null;
            let id = null;
            if (product) {
                cc = product.getPriceModel().getPrice().currencyCode.toUpperCase();
                id = product.ID;
            } else {
                cc = li.adjustedNetPrice.currencyCode.toUpperCase();
                id = li.productID;
            }
            let s = '' + li.getQuantity().value + ',' + id + ',' + cc;
            cksum += crc32(s);
            Logger.debug('Line and checksum: ' + s + ' Checksum:' + cksum);
        });
        Logger.debug('Final Checksum' + cksum);
        return cksum;
    },
    // compute a checksum for the current shipping address so we can check
    // if anything changed
    computeBasketShippingChecksum: function (ctnr) {
        let crc32 = require('*/cartridge/scripts/util/clearpayUtilities.js').crc32;
        let address = ctnr.defaultShipment.shippingAddress;
        if (!address) {
            return 0;
        }
        let s = (address.address1 || '') + ',' + (address.address2 || '') + ',' + (address.city || '') + ','
            + (address.stateCode || '').toUpperCase() + ',' + (address.postalCode || '') + ',' + (address.countryCode.value || '').toUpperCase();
        let cksum = crc32(s);
        Logger.debug('Address and checksum: ' + s + ' Checksum:' + cksum);

        return cksum;
    },
    isPriceWithinThreshold: function (price) {
        if (!price) {
            return false;
        }
        var isWithinThreshold = thresholdUtilities.checkThreshold(price);
        return isWithinThreshold.status;
    },
    isBasketAmountWithinThreshold: function () {
        var basket = dw.order.BasketMgr.getCurrentBasket();
        if (!basket) {
            return false;
        }
        let orderTotal = basket.totalGrossPrice.available ? basket.totalGrossPrice : basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);

        var isWithinThreshold = thresholdUtilities.checkThreshold(orderTotal);
        return isWithinThreshold.status;
    },
    // compute a checksum from the Clearpay Response
    // if anything changed
    computeResponseProductLineItemChecksum: function (ctnr) {
        let crc32 = require("*/cartridge/scripts/util/clearpayUtilities.js").crc32;
        // Should use whatever info we use in building the create checkout
        var lineItems = new ArrayList(ctnr.items);
        var cpItemsList = lineItems.iterator();
        let cksum = 0;
        while (cpItemsList.hasNext()) {
            let cpProductLineItem = cpItemsList.hasNext() ? cpItemsList.next() : '';
            let cc = cpProductLineItem.price.currency;
            let id = cpProductLineItem.sku ? cpProductLineItem.sku : '';
            let s = "" + cpProductLineItem.quantity + "," + id + "," + cc;
            cksum += crc32(s);
            Logger.debug("Line and checksum: " + s + " Checksum:" + cksum);
        }
        Logger.debug("Final Checksum" + cksum);
        return cksum;
    }
};

module.exports = checkoutTools;
