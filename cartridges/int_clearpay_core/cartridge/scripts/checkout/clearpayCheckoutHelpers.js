'use strict';

var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var ArrayList = require('dw/util/ArrayList');
var BasketMgr = require('dw/order/BasketMgr');
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
        // eslint-disable-next-line no-useless-escape
        var regex = /^(1-?)(\(?([2-9][0-8][0-9])\)?[\-\. ]?([2-9][0-9]{2})[\-\. ]?([0-9]{4})(\s*x[0-9]+)?)$/;
        var found = phone.match(regex);
        if (found) {
            // eslint-disable-next-line no-param-reassign
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
        var name = this.splitName(cpBilling.name || '');
        var stripLeadingOne = this.stripUSPhoneNumberLeadingOne;

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
        var storeMap = {};
        var lineItemsIter = basket.allProductLineItems.iterator();
        while (lineItemsIter.hasNext()) {
            var lineItem = lineItemsIter.next();
            if (lineItem.custom.fromStoreId) {
                storeMap[lineItem.custom.fromStoreId] = dw.catalog.StoreMgr.getStore(lineItem.custom.fromStoreId);
            }
        }
        return storeMap;
    },
    getNumHomeDeliveries: function (basket) {
        var cnt = 0;
        var lineItemsIter = basket.allProductLineItems.iterator();
        while (lineItemsIter.hasNext()) {
            var lineItem = lineItemsIter.next();
            if (!lineItem.custom.fromStoreId) {
                ++cnt;
            }
        }
        return cnt;
    },
    getCurrentClearpayPaymentAmount: function (basket) {
        // Just gets the amount currently associated with the Clearpay payment instrument
        var paymentMethod = cpCheckoutUtilities.getPaymentMethodName();
        var pi = basket.getPaymentInstruments(paymentMethod);
        if (pi.length == 0) {
            return new dw.value.Money(0.0, basket.currencyCode);
        }
        var payment = pi[0].getPaymentTransaction();
        if (!payment) {
            return new dw.value.Money(0.0, basket.currencyCode);
        }
        return payment.amount;
    },
    // compute a checksum for the current items in the basket so we can check
    // if anything changed
    computeBasketProductLineItemChecksum: function (ctnr) {
        var crc32 = cpUtilities.crc32;
        // Should use whatever info we use in building the create checkout
        var lineItems = ctnr.getAllProductLineItems().toArray();
        var cksum = 0;
        // eslint-disable-next-line array-callback-return
        lineItems.map(function (li) {
            var product = li.product;
            // just ignore names. Using quantity/productid/price/currency
            // product can be null if line-item is something like a warranty. Just ignoring those.
            var cc = null;
            var id = null;
            if (product) {
                cc = product.getPriceModel().getPrice().currencyCode.toUpperCase();
                id = product.ID;
            } else {
                cc = li.adjustedNetPrice.currencyCode.toUpperCase();
                id = li.productID;
            }
            var s = '' + li.getQuantity().value + ',' + id + ',' + cc;
            cksum += crc32(s);
            Logger.debug('Line and checksum: ' + s + ' Checksum:' + cksum);
        });
        Logger.debug('Final Checksum' + cksum);
        return cksum;
    },
    // compute a checksum for the current shipping address so we can check
    // if anything changed
    computeBasketShippingChecksum: function (ctnr) {
        var crc32 = require('*/cartridge/scripts/util/clearpayUtilities.js').crc32;
        var address = ctnr.defaultShipment.shippingAddress;
        if (!address) {
            return 0;
        }
        var s = (address.address1 || '') + ',' + (address.address2 || '') + ',' + (address.city || '') + ','
            + (address.stateCode || '').toUpperCase() + ',' + (address.postalCode || '') + ',' + (address.countryCode.value || '').toUpperCase();
        var cksum = crc32(s);
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
    isPDPBasketAmountWithinThreshold: function () {
        var basket = BasketMgr.getCurrentBasket();
        var withinTheshold = true;

        if (basket && basket.getAllProductLineItems().length > 0) {
            var orderTotal = basket.totalGrossPrice.available ? basket.totalGrossPrice : basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);
            withinTheshold = thresholdUtilities.checkThreshold(orderTotal).status && !this.checkRestrictedCart();
        }

        return withinTheshold;
    },
    isBasketAmountWithinThreshold: function () {
        var basket = BasketMgr.getCurrentBasket();
        if (!basket) {
            return false;
        }
        var orderTotal = basket.totalGrossPrice.available ? basket.totalGrossPrice : basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);

        return thresholdUtilities.checkThreshold(orderTotal).status && !this.checkRestrictedCart();
    },
    // compute a checksum from the Clearpay Response
    // if anything changed
    computeResponseProductLineItemChecksum: function (ctnr) {
        var crc32 = require('*/cartridge/scripts/util/clearpayUtilities.js').crc32;
        // Should use whatever info we use in building the create checkout
        var lineItems = new ArrayList(ctnr.items);
        var cpItemsList = lineItems.iterator();
        var cksum = 0;
        while (cpItemsList.hasNext()) {
            var cpProductLineItem = cpItemsList.hasNext() ? cpItemsList.next() : '';
            var cc = cpProductLineItem.price.currency;
            var id = cpProductLineItem.sku ? cpProductLineItem.sku : '';
            var s = '' + cpProductLineItem.quantity + ',' + id + ',' + cc;
            cksum += crc32(s);
            Logger.debug('Line and checksum: ' + s + ' Checksum:' + cksum);
        }
        Logger.debug('Final Checksum' + cksum);
        return cksum;
    },
    checkRestrictedCart: function () {
        var currentBasket = BasketMgr.getCurrentBasket();
        if (currentBasket && currentBasket.getAllProductLineItems().length > 0) {
            var productLineItems = currentBasket.getAllProductLineItems().iterator();
            var ProductMgr = require('dw/catalog/ProductMgr');
            while (productLineItems.hasNext()) {
                var productLineItem = productLineItems.next();
                var product = productLineItem.product;

                if (!product) {
                    var parentProductID = productLineItem.parent.productID;
                    product = ProductMgr.getProduct(parentProductID);
                }

                if (product) {
                    var reqProductID = product.ID;
                    if (this.checkRestrictedProducts(reqProductID)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },
    checkRestrictedProducts: function (reqProductID) {
        var cpSitePreferences = require('*/cartridge/scripts/util/clearpayUtilities').sitePreferencesUtilities;
        var clearpayRestrictedProducts = cpSitePreferences.getRestrictedProducts();
        var ProductMgr = require('dw/catalog/ProductMgr');
        var product = ProductMgr.getProduct(reqProductID);

        if (product && product.isVariant()) {
            if (product.masterProduct.ID && clearpayRestrictedProducts.indexOf(product.masterProduct.ID) > '-1') {
                return true;
            }
        }

        if (reqProductID && clearpayRestrictedProducts.indexOf(reqProductID) > '-1') {
            return true;
        }
        return false;
    }
};

module.exports = checkoutTools;
