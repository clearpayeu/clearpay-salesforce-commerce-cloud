'use strict';
var { checkoutUtilities: cpCheckoutUtilities } = require('*/cartridge/scripts/util/clearpayUtilities');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');

var checkoutTools = {
    // given a PriceModel, gets the actual price we should use for Clearpay messaging
    getProductPriceForMessaging: function (price) {
        if (price.sales) {
            return price.sales;
        } else if (price.list) {
            return price.list;
        } else if (price.min && price.min.sales) {
            return price.min.sales;
        } else if (price.min && price.min.list) {
            return price.min.list;
        } else if (price.tiers) {
            if (price.tiers[0].price && price.tiers[0].price.sales) {
                return price.tiers[0].price.sales;
            } else if (price.tiers[0].price && price.tiers[0].price.list) {
                return price.tiers[0].price.list;
            }
        }
        return null;
    },
    // copy the shipping address to the default shipment in the basket
    // unless it's an instore pickup shipment
    addShippingAddressToBasket: function (basket, cpShipping) {
        var Transaction = require('dw/system/Transaction');
        var shipment = basket.defaultShipment;
        var shippingAddress = shipment.shippingAddress;

        // Only do copy when defaultShipment is not storepickup
        var storepickup = shipment.custom.shipmentType === 'instore';
        if (storepickup) {
            return;
        }

        /*
        there are some utility methods if we need them
        COHelpers.copyShippingAddressToShipment(
            shippingData,
            basket.defaultShipment
        );
        */
        let name = ClearpayCOHelpers.splitName(cpShipping.name || '');
        let stripLeadingOne = ClearpayCOHelpers.stripUSPhoneNumberLeadingOne;
        Transaction.wrap(function () {
            if (shippingAddress === null) {
                shippingAddress = shipment.createShippingAddress();
            }
            shippingAddress.setFirstName(name.firstName || '');
            shippingAddress.setLastName(name.lastName || '');
            shippingAddress.setAddress1(cpShipping.line1 || '');
            shippingAddress.setAddress2(cpShipping.line2 || '');
            shippingAddress.setCity(cpShipping.area1 || '');
            shippingAddress.setPostalCode(cpShipping.postcode || '');
            shippingAddress.setStateCode(cpShipping.region || '');
            shippingAddress.setCountryCode(cpShipping.countryCode || '');
            if (cpShipping.countryCode.toUpperCase() === 'US') {
                shippingAddress.setPhone(stripLeadingOne(cpShipping.phoneNumber || ''));
            } else {
                shippingAddress.setPhone(cpShipping.phoneNumber || '');
            }
        });
    },
    shouldEnableExpressPickupMode: function (basket) {
        basket = basket || dw.order.BasketMgr.getCurrentBasket();
        if (!basket) {
            return false;
        }
        let storeMap = ClearpayCOHelpers.getInStorePickupsMap(basket);
        // items that are being shipped
        let numNonStorePickups =ClearpayCOHelpers.getNumHomeDeliveries(basket);
        if ((numNonStorePickups == 0) && (Object.keys(storeMap).length == 1)) {
            return true;
        }
        return false;
    },
    getCartShipmentType: function (basket) {
        let storeMap = ClearpayCOHelpers.getInStorePickupsMap(basket);
        let numHomeDeliveries = ClearpayCOHelpers.getNumHomeDeliveries(basket);
        var shipmentType = '';

        if ((numHomeDeliveries == 0) && (Object.keys(storeMap).length == 1)) {
            shipmentType = 'SingleStorePickup';
        } else if (((numHomeDeliveries > 0) && (Object.keys(storeMap).length > 0))) {
            shipmentType = 'SplitShipment';
        } else if(Object.keys(storeMap).length > 1){
            shipmentType = 'MultiplePickup';
        }

        return shipmentType;
    },
    removeAllNonGiftCertificatePayments: function (basket) {
        let PaymentInstrument = require('dw/order/PaymentInstrument');
        var Transaction = require('dw/system/Transaction');
        Transaction.wrap(function () {
            let payInstr = basket.getPaymentInstruments();
            let iter = payInstr.iterator();
            while (iter.hasNext()) {
                let pi = iter.next();
                if (!PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals(pi.getPaymentMethod())) {
                    basket.removePaymentInstrument(pi);
                }
            }
        });
    },
    removeClearpayPayments: function (basket) {
        let PaymentInstrument = require('dw/order/PaymentInstrument');
        var Transaction = require('dw/system/Transaction');
        var paymentMethod = cpCheckoutUtilities.getPaymentMethodName();
        Transaction.wrap(function () {
            let payInstr = basket.getPaymentInstruments(paymentMethod);
            let iter = payInstr.iterator();
            while (iter.hasNext()) {
                let pi = iter.next();
                basket.removePaymentInstrument(pi);
            }
        });
    },
    calculateAndSetPaymentAmount: function (basket) {
        var Transaction = require('dw/system/Transaction');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');

        Transaction.wrap(function () {
            cartHelper.ensureAllShipmentsHaveMethods(basket);
            basketCalculationHelpers.calculateTotals(basket);
        });

        // Re-calculate the payments.
        var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
            basket
        );
    }
};

module.exports = checkoutTools;
