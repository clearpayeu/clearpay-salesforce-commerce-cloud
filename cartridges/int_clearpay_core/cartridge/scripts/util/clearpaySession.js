'use strict';

// Mainly for Clearpay Express Checkout to store state in session
// Just wrapper to avoid making direct session references
// Note: SFCC only supports setting primitives in session, not objects
var ClearpaySession = {
    newSession: function (token) {
        session.custom.clearpay_token = token;
        session.custom.clearpay_merchant_reference = '';
        session.custom.clearpay_express_checkout = false;
        session.custom.clearpay_express_checkout_finalize_flow = false;
        session.custom.clearpay_express_checkout_amount = 0;
        session.custom.clearpay_express_checkout_currency = '';
        session.custom.clearpay_express_checkout_checksum = '';
        session.custom.clearpay_express_checkout_shipping_checksum = 0;
        session.custom.clearpay_express_checkout_items_checksum = 0;
        session.custom.clearpay_express_instore_pickup = false;
        session.custom.clearpay_express_split_shipment = false;
    },
    // Call this whenever the Clearpay Express transaction should be completely cleared
    clearSession: function () {
        delete session.custom.clearpay_token;
        delete session.custom.clearpay_merchant_reference;
        delete session.custom.clearpay_express_checkout;
        delete session.custom.clearpay_express_checkout_finalize_flow;
        delete session.custom.clearpay_express_checkout_amount;
        delete session.custom.clearpay_express_checkout_currency;
        delete session.custom.clearpay_express_checkout_checksum;
        delete session.custom.clearpay_express_checkout_shipping_checksum;
        delete session.custom.clearpay_express_checkout_items_checksum;
        delete session.custom.clearpay_express_instore_pickup;
        delete session.custom.clearpay_express_split_shipment;
    },
    isValid: function () {
        return (!empty(session.custom.clearpay_token));
    },
    getToken: function () {
        return session.custom.clearpay_token;
    },
    setExpressCheckout: function (val) {
        session.custom.clearpay_express_checkout = val;
    },
    isExpressCheckout: function () {
        return session.custom.clearpay_express_checkout == true;
    },

    setExpressCheckoutFinalizeFlow: function (val) {
        session.custom.clearpay_express_checkout_finalize_flow = val;
    },
    isExpressCheckoutFinalizeFlow: function () {
        return session.custom.clearpay_express_checkout_finalize_flow == true;
    },


    setExpressCheckoutAmount: function (amount) {
        session.custom.clearpay_express_checkout_amount = amount;
    },
    getExpressCheckoutAmount: function () {
        return session.custom.clearpay_express_checkout_amount;
    },
    setExpressCheckoutCurrency: function (currency) {
        session.custom.clearpay_express_checkout_currency = currency;
    },
    getExpressCheckoutCurrency: function () {
        return session.custom.clearpay_express_checkout_currency;
    },
    setShippingChecksum: function (cksum) {
        session.custom.clearpay_express_checkout_shipping_checksum = cksum;
    },
    getShippingChecksum: function () {
        return session.custom.clearpay_express_checkout_shipping_checksum;
    },
    setItemsChecksum: function (cksum) {
        session.custom.clearpay_express_checkout_items_checksum = cksum;
    },
    getItemsChecksum: function () {
        return session.custom.clearpay_express_checkout_items_checksum;
    },
    setMerchantReference: function (mr) {
        session.custom.clearpay_merchant_reference = mr;
    },
    getMerchantReference: function () {
        return session.custom.clearpay_merchant_reference;
    },
    setExpressCheckoutInstorePickup: function (val) {
        session.custom.clearpay_express_instore_pickup = val;
    },
    isExpressCheckoutInstorePickup: function () {
        return session.custom.clearpay_express_instore_pickup;
    },
    setIsSplitShipment: function (val) {
        session.custom.clearpay_express_split_shipment = val;
    },
    getIsSplitShipment: function () {
        return session.custom.clearpay_express_split_shipment;
    },
    debugGetSessionAsString: function () {
        return 'token: ' + session.custom.clearpay_token + ' express_checkout: ' + session.custom.clearpay_express_checkout
          + ' finalize_flow: ' + session.custom.clearpay_express_checkout_finalize_flow + ' checkout_amount: ' + session.custom.clearpay_express_checkout_amount
          + ' instore_pickup: ' + session.custom.clearpay_express_checkout_amount;
    }
};

module.exports = ClearpaySession;
