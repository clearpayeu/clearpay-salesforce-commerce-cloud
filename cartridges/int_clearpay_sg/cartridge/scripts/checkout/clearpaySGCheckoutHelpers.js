'use strict';
var { sitePreferencesUtilities: sitePreferences } = require('*/cartridge/scripts/util/clearpayUtilities');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');


/* Script Modules */
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');

var checkoutTools = {
    addShippingAddressToBasket: function (basket, cpShipping) {
        var Transaction = require('dw/system/Transaction');
        var shipment = basket.defaultShipment;
        var shippingAddress = shipment.shippingAddress;

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
    getShippingMethodsForAddress: function (cart, cpShipping) {
        var TransientAddress = app.getModel('TransientAddress');
        var address = new TransientAddress();
        address.countryCode = cpShipping.countryCode || '';
        address.stateCode = cpShipping.region || '';
        address.postalCode = cpShipping.postcode || '';
        address.city = cpShipping.area1 || '';
        address.address1 = cpShipping.line1 || '';
        address.address2 = cpShipping.line2 || '';

        var applicableShippingMethods = cart.getApplicableShippingMethods(address);
        return applicableShippingMethods;
    },
    getDefaultShippingMethodForAddress: function (cart, cpShipping) {
        let shipMethods = this.getShippingMethodsForAddress(cart, cpShipping);
        let shipIter = shipMethods.iterator();
        while (shipIter.hasNext()) {
            let shipMethod = shipIter.next();
            if (shipMethod.defaultMethod == true) {
                return shipMethod;
            }
        }
        return null;
    },
    shouldEnableExpressPickupMode: function (cart) {
        if (!cart) {
            cart = app.getModel('Cart').get();
        }
        if (!cart) {
            return false;
        }
        let storeMap = ClearpayCOHelpers.getInStorePickupsMap(cart.object);
        // items that are being shipped
        let numNonStorePickups = ClearpayCOHelpers.getNumHomeDeliveries(cart.object);
        if ((numNonStorePickups == 0) && (Object.keys(storeMap).length == 1)) {
            return true;
        }
        return false;
    },
    removeAllNonGiftCertificatePayments: function (cart) {
        let PaymentInstrument = require('dw/order/PaymentInstrument');

        let payInstr = cart.getPaymentInstruments();
        let iter = payInstr.iterator();
        while (iter.hasNext()) {
            let pi = iter.next();
            if (!PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals(pi.getPaymentMethod())) {
                cart.removePaymentInstrument(pi);
            }
        }
    },
    disableSummaryForClearpay: function (cart, viewContext) {
        var clearpayEnable = sitePreferences.isClearpayEnabled();
        var expressCheckoutEnable = sitePreferences.isExpressCheckoutEnabled();
        let isExpressCheckout = require('*/cartridge/scripts/util/clearpaySession').isExpressCheckout();
    
        var cpPaymentInstrument;
        var iter = cart.object.getPaymentInstruments().iterator();
    
        while (iter.hasNext()) {
            cpPaymentInstrument = iter.next();
    
            // don't disable summary for express checkout when the current order is an express checkout order.
            // Non-express-checkout still skips summary screen
            if ((expressCheckoutEnable && isExpressCheckout) || clearpayEnable == false || cpPaymentInstrument.paymentMethod !== 'AFTERPAY' || cpPaymentInstrument.paymentMethod !== 'CLEARPAY') {
                app.getView(viewContext).render('checkout/summary/summary');
            }
        }
    }
};

module.exports = checkoutTools;
