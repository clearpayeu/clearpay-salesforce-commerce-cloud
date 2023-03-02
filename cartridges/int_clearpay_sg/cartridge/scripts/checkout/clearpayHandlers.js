'use strict';

var cpCheckoutUtilities = require('*/cartridge/scripts/util/clearpayUtilities').checkoutUtilities;
var sitePreferences = require('*/cartridge/scripts/util/clearpayUtilities').sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');

var cpHandlers = {
    // recompute the amount for the Clearpay payment instrument
    recomputeClearpayPayment: function () {
        var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
        if (ClearpaySession.isExpressCheckout()) {
            var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
            var Transaction = require('dw/system/Transaction');

            var cart = app.getModel('Cart').get();
            if (cart) {
                // Just make sure there's an Clearpay payment instrument before computing the amount
                var pi = cart.object.getPaymentInstruments(paymentMethodName);
                if (pi.length === 0) {
                    return;
                }
                Transaction.wrap(function () {
                    require('~/cartridge/scripts/checkout/clearpaySGCheckoutHelpers').removeAllNonGiftCertificatePayments(cart);
                    cart.object.createPaymentInstrument(paymentMethodName, new dw.value.Money(0.0, cart.object.currencyCode));
                    // will compute the amount for us for the payment instrument
                    cart.calculatePaymentTransactionTotal();
                });
            }
        }
    },
    // only call when changing to non-Clearpay payment method
    handleChangedPaymentInstrument: function (paymentMethod) {
        if (paymentMethod != 'CLEARPAY') {
            this.removePaymentMethods();
        }
    },
    // When the shipping method is updated, we need to update the Clearpay
    // payment in the cart with the correct amount
    handleShippingMethodUpdate: function () {
        this.recomputeClearpayPayment();
    },
    handleBillingStart: function () {
        this.recomputeClearpayPayment();
    },
    removePaymentMethods: function () {
        var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
        var cart = app.getModel('Cart').get();
        cart.removePaymentInstruments(cart.getPaymentInstruments(paymentMethodName));
        // clears all session vars used by Clearpay
        ClearpaySession.clearSession();
    }
};

module.exports = cpHandlers;
