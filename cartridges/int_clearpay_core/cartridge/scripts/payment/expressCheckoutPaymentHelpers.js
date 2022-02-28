'use strict';

var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
var ExpressCaptureRequestBuilder = require('~/cartridge/scripts/payment/expressCaptureRequestBuilder');
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
            let orderToken = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction().custom.cpToken;
            // May need a way to get a session snapshot
            if (ClearpaySession.getToken(orderToken) == orderToken) {
                let lineItemsChanged = this.checkIfLineItemsChanged(order);
                let shippingChanged = this.checkIfShippingChanged(order);
                expressCheckoutModel.cpTempShippingAddressChanged = shippingChanged;
                expressCheckoutModel.cpTempBasketItemsChanged = lineItemsChanged;
                let initialCheckoutAmount = new dw.value.Money(ClearpaySession.getExpressCheckoutAmount(), ClearpaySession.getExpressCheckoutCurrency());
                let pt = order.getPaymentInstruments(paymentMethod)[0].getPaymentTransaction();
                let amount = pt.amount;
                if (!initialCheckoutAmount.equals(amount)) {
                    expressCheckoutModel.cpTempCheckoutAmountChanged = true;
                }
            }
        }
        return expressCheckoutModel;
    },
    checkIfLineItemsChanged: function (order) {
        let cksum = ClearpayCOHelpers.computeBasketProductLineItemChecksum(order);
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

        let cksum = ClearpayCOHelpers.computeBasketShippingChecksum(order);
        if (cksum != ClearpaySession.getItemsChecksum()) {
            return true;
        }
        return false;
    }
};

module.exports = ExpressCheckoutPaymentHelpers;
