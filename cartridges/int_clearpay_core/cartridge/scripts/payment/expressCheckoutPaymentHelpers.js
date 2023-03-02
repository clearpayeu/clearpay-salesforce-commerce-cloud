'use strict';

var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpCheckoutUtilities = cpUtilities.checkoutUtilities;

var ExpressCheckoutPaymentHelpers = {

    createExpressCheckoutModelFromOrderAndSession: function (order) {
        // setting saved in PaymentTransaction for Express Checkout.
        var ExpressCheckoutModel = require('*/cartridge/scripts/models/expressCheckoutModel');
        var expressCheckoutModel = new ExpressCheckoutModel();
        var paymentMethod = cpCheckoutUtilities.getPaymentMethodName();
        expressCheckoutModel.cpExpressCheckout = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction().custom.cpExpressCheckout;
        expressCheckoutModel.cpExpressCheckoutChecksum = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction().custom.cpExpressCheckoutChecksum;
        if (expressCheckoutModel.cpExpressCheckout) {
            var orderToken = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction().custom.cpToken;
            // May need a way to get a session snapshot
            if (ClearpaySession.getToken(orderToken) == orderToken) {
                var lineItemsChanged = this.checkIfLineItemsChanged(order);
                var shippingChanged = this.checkIfShippingChanged(order);
                expressCheckoutModel.cpTempShippingAddressChanged = shippingChanged;
                expressCheckoutModel.cpTempBasketItemsChanged = lineItemsChanged;
                var initialCheckoutAmount = new dw.value.Money(ClearpaySession.getExpressCheckoutAmount(), ClearpaySession.getExpressCheckoutCurrency());
                var pt = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction();
                var amount = pt.amount;
                if (!initialCheckoutAmount.equals(amount)) {
                    expressCheckoutModel.cpTempCheckoutAmountChanged = true;
                }
            }
        }
        return expressCheckoutModel;
    },
    checkIfLineItemsChanged: function (order) {
        var cksum = ClearpayCOHelpers.computeBasketProductLineItemChecksum(order);
        if (cksum != ClearpaySession.getItemsChecksum()) {
            return true;
        }
        return false;
    },
    checkIfShippingChanged: function (order) {
        // If the order was originally an in-store pickup, but was
        // changed to home ship during Clearpay Widget finalize flow,
        // consider it a shipping change so capture/auth will send
        // the new address
        if (ClearpaySession.isExpressCheckoutInstorePickup()) {
            // check whether the order is still an in-store pickup
            if (ClearpayCOHelpers.getNumHomeDeliveries(order) > 0) {
                return true;
            }
            return false;
        }

        var cksum = ClearpayCOHelpers.computeBasketShippingChecksum(order);
        if (cksum != ClearpaySession.getItemsChecksum()) {
            return true;
        }
        return false;
    }
};

module.exports = ExpressCheckoutPaymentHelpers;
