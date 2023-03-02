'use strict';

/**
 * returns expressCheckoutModel
 * */
function ExpressCheckoutModel() {
    // Note: These correspond to fields that were added to PaymentTransaction
    // for Express Checkout support
    var expressCheckoutModelObject = {
        cpExpressCheckout: false,
        cpExpressCheckoutChecksum: '',
        cpTempShippingAddressChanged: false,
        cpTempBasketItemsChanged: false,
        cpTempCheckoutAmountChanged: null
    };
    this.ExpressCheckoutModel = expressCheckoutModelObject;
}

module.exports = ExpressCheckoutModel;
