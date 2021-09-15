'use strict';

function ExpressCheckoutModel() {
    // Note: These correspond to fields that were added to PaymentTransaction
    // for Express Checkout support
    var expressCheckoutModelObject = {
        cpExpressCheckout: false,
        cpExpressCheckoutChecksum: '',
        apTempShippingAddressChanged: false,
        apTempBasketItemsChanged: false,
        apTempCheckoutAmountChanged: null
    };
    this.ExpressCheckoutModel = expressCheckoutModelObject;
}

module.exports = ExpressCheckoutModel;
