'use strict';
var clearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var sitePreferences = clearpayUtilities.sitePreferencesUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var apCheckoutUtilities = clearpayUtilities.checkoutUtilities;

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');

var apHandlers = {
    // recompute the amount for the Clearpay payment instrument
    recomputeClearpayPayment: function() {
        var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
        if (ClearpaySession.isExpressCheckout()) {
            var Transaction = require('dw/system/Transaction');
            var COHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');

            var cart = app.getModel('Cart').get();
            if (cart) {
                // Just make sure there's an Clearpay payment instrument before computing the amount
                var pi = cart.object.getPaymentInstruments(paymentMethodName);
                if (pi.length === 0) {
                    return;
                }
                Transaction.wrap(function () {
                    COHelpers.removeAllNonGiftCertificatePayments(cart);
                    var paymentInstrument = cart.object.createPaymentInstrument(paymentMethodName, new dw.value.Money(0.0, cart.object.currencyCode));
                    // will compute the amount for us for the payment instrument
                    cart.calculatePaymentTransactionTotal();
                });
            }
        }
    },
    // only call when changing to non-Clearpay payment method
    handleChangedPaymentInstrument: function() {
        var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
        var cart = app.getModel('Cart').get();
        cart.removePaymentInstruments( cart.getPaymentInstruments(paymentMethodName));
        // clears all session vars used by Clearpay
        ClearpaySession.clearSession();
    },
    // When the shipping method is updated, we need to update the Clearpay
    // payment in the cart with the correct amount
    handleShippingMethodUpdate: function() {
        this.recomputeClearpayPayment();
    },
    handleBillingStart: function() {
        this.recomputeClearpayPayment();
    }

};

module.exports = apHandlers;