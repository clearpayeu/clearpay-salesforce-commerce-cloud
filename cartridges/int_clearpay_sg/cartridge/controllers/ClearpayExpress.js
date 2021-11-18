'use strict';

/* API Includes */
var URLUtils = require('dw/web/URLUtils');
var Transaction = require('dw/system/Transaction');
var System = require('dw/system');
var	Resource = require('dw/web/Resource');
var Money = require('dw/value/Money');

/* Global variables */
var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var sitePreferences = ClearpayUtilities.sitePreferencesUtilities;
var apCheckoutUtilities = ClearpayUtilities.checkoutUtilities;
var ctrlCartridgeName = sitePreferences.getControllerCartridgeName();
var clearpayEnabled = sitePreferences.isClearpayEnabled();
var expressCheckoutEnabled = sitePreferences.isExpressCheckoutEnabled();

/* Script Modules */
var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var guard = require(ctrlCartridgeName + '/cartridge/scripts/guard');
var Cart = require(ctrlCartridgeName + '/cartridge/scripts/models/CartModel');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayExpress');
var ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
var responseUtils = require('*/cartridge/scripts/util/Response');
var cpBrandUtilities = ClearpayUtilities.brandUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var brand = cpBrandUtilities.getBrand();
var threshold = thresholdUtilities.getThresholdAmounts(brand);
var COHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');


function redirectToErrorDisplay(error) {
    let redirectURL = dw.web.URLUtils.https('COBilling-Start', 'clearpay', error);
    app.getView({
        ClearpayRedirectUrl: redirectURL
    }).render('checkout/redirect');
}


/*
* Just using this for debugging
*/
function DebugOrder() {
    let action = request.httpParameterMap.cartAction;
    if (action === 'showsession') {
        let sess = ClearpaySession.debugGetSessionAsString();
        responseUtils.renderJSON({ type: 'DebugOrder', session: sess });
    } else if (action == 'clearsession') {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({ type: 'DebugOrder', status: 'Session cleared' });
    }
}

// Check the cart and get cart total and whether the cart qualifies for in-store pickup Express Checkout option
// Needed to detect in-store pickup option when customer changes to/from in-store and the
// cart.isml does not get a chance to reload
// Can be used to get updated cart total amount for Clearpay widget if there are ajax calls on
// Clearpay widget page that can affect the cart totals.
function CartStatus() {
    let inStorePickup = false;
    if (!clearpayEnabled || !expressCheckoutEnabled) {
        responseUtils.renderJSON({});
        return;
    }
    let cart = app.getModel('Cart').get();
    if (!cart) {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({});
        return;
    }

    let ShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');
    let cartTotals = ShippingHelpers.calculateCartTaxShipTotals(cart);

    var clearpayExpressPickupEnabled = COHelpers.shouldEnableExpressPickupMode();
    responseUtils.renderJSON({ cartTotalAmount: cartTotals.totalCost.value, cartTotalCurrency: cartTotals.totalCost.currencyCode, instorepickup: clearpayExpressPickupEnabled });
}

/**
 * Handles the payment status returned by the Clearpay. Based on the status Order will be submitted .
 */
function CreateToken() {
    if (!clearpayEnabled || !expressCheckoutEnabled) {
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.disabled', brand, null) });
        return;
    }
    var ShippingMgr = require('dw/order/ShippingMgr');
    var ShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');
    // reset all session params if user clicks checkout again
    let ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
    ClearpaySession.clearSession();

    var Transaction = require('dw/system/Transaction');

    // Check if we need to add a product to the cart. This is to support the Clearpay Express
    // button on a product details page.
    let action = request.httpParameterMap.cartAction;
    if (action && action.stringValue === 'add') {
        var cart = app.getModel('Cart').goc();
        // Note: we are calling addProductToCart the same way it would normally be called from Cart-AddProduct.
        // addProductToCart will read the current request's httpParameterMap, so we just have to make sure we're
        // being called the same way as Cart-AddProduct
        cart.addProductToCart();
    }

    var cart = app.getModel('Cart').get();
    if (!cart) {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.emptycart', brand, null) });
        return;
    }


    // Get a map of storeId -> store .
    let storeMap = COHelpers.getInStorePickupsMap(cart.object);
    let numHomeDeliveries = COHelpers.getNumHomeDeliveries(cart.object);

    let store = null;
    let storePickup = false;
    let expressCheckoutShippingStrategy = sitePreferences.getExpressCheckoutShippingStrategy();
    
    // Make sure everything is only going to a single store and there are no home deliveries.
    // If so, we use in-store pickup mode for express checkout
    if ((numHomeDeliveries == 0) && (Object.keys(storeMap).length == 1)) {
        storePickup = true;
        for (var key in storeMap) {
            store = storeMap[key];
        }
    } else if ((numHomeDeliveries > 0) && (Object.keys(storeMap).length > 0) && expressCheckoutShippingStrategy == 'integrated') {
        // If there are items going to multiple places, we can't use express checkout
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.multidestination', brand, null) });
        return;
    } else if (Object.keys(storeMap).length > 1) {
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.multidestination', brand, null) });
        return;
    }
    // NOTE: We need to check for multi-shipping as well

    let sourceUrl = request.httpParameterMap.s_url.stringValue;

    // merchantnum is currently unused. Just pass in a "x"
    // var merchantOrderNum = Math.random().toString(36).substring(2, 15);
    var merchantOrderNum = 'x';

    // We need to keep track of what we're using with create checkout so we can compute the
    // delta for Clearpay checkout widget later.
    // Note that if we change this, we need to change the request builder as well.
    Transaction.wrap(function () {
        let currentShippingMethod = cart.getDefaultShipment().getShippingMethod() || ShippingMgr.getDefaultShippingMethod();
        cart.updateShipmentShippingMethod(cart.getDefaultShipment().getID(), currentShippingMethod.getID(), null, null);
        cart.calculate();
    });

    // This is the initial amount we will create the checkout with
    // var createCheckoutPrice = cart.object.getAdjustedMerchandizeTotalGrossPrice();
    var createCheckoutPrice = cart.getNonGiftCertificateAmount();
    if (!COHelpers.isPriceWithinThreshold(createCheckoutPrice)) {
        responseUtils.renderJSON({ status: 'FAILURE',
            error: Resource.msgf('minimum.threshold.message', brand, null, new Money(threshold.minAmount, cart.object.currencyCode)
             , new Money(threshold.maxAmount, cart.object.currencyCode)) });
        return;
    }

    // Need to pass the amount in as well, not just compute it from the cart.
    var clearPayTokenResponse = require('*/cartridge/scripts/checkout/clearpayExpressGetToken').getExpressToken(cart, createCheckoutPrice, sourceUrl, merchantOrderNum, store);
    if (clearPayTokenResponse.error) {
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.gettoken', brand, null) });
        return;
    }

    var orderToken = clearPayTokenResponse.cpToken;
    if (!orderToken) {
        responseUtils.renderJSON({ status: 'FAILURE', error: Resource.msg('expresscheckout.error.gettoken', brand, null) });
        return;
    }
    ClearpaySession.newSession(orderToken);
    ClearpaySession.setExpressCheckout(true);
    ClearpaySession.setMerchantReference(merchantOrderNum);
    ClearpaySession.setExpressCheckoutAmount(createCheckoutPrice.value);
    ClearpaySession.setExpressCheckoutCurrency(createCheckoutPrice.currencyCode);
    // Store a checksum of the line items into the session. Check this before we do a capture.
    ClearpaySession.setItemsChecksum(COHelpers.computeBasketProductLineItemChecksum(cart.object));

    app.getController('COShipping').PrepareShipments();

    responseUtils.renderJSON({ status: 'SUCCESS', token: clearPayTokenResponse, merchantRef: merchantOrderNum });
}

/**
 * Most of the logic for computing shipping costs is from COShipping-UpdateShippingMethodList
 */
function GetShippingMethods() {
    if (!clearpayEnabled || !expressCheckoutEnabled) {
        responseUtils.renderJSON([]);
        return;
    }
    var ShippingMgr = require('dw/order/ShippingMgr');
    var HashMap = require('dw/util/HashMap');
    var ShippingHelpers = require('~/cartridge/scripts/checkout/clearpayShippingHelpers');

    var i,
        address,
        applicableShippingMethods,
        currentShippingMethod,
        method;
    var cart = app.getModel('Cart').get();
    var TransientAddress = app.getModel('TransientAddress');

    if (!cart) {
        Logger.error(Resource.msg('expresscheckout.error.emptycart', brand, null));
        ClearpaySession.clearSession();
        responseUtils.renderJSON([]);
        return;
    }

    if (COHelpers.shouldEnableExpressPickupMode(cart)) {
        // if this is a store pickup, just get the store name
        let storeMap = COHelpers.getInStorePickupsMap(cart.object);
        let store = null;
        for (var key in storeMap) {
            store = storeMap[key];
        }
        if (store) {
            // The cart should only have in-store pickup items at this point
            let costs = ShippingHelpers.calculateCartTaxShipTotals(cart);
            responseUtils.renderJSON([{
                id: store.ID,
                name: store.name,
                description: sitePreferences.getStorePickupDescription(),
                shippingAmount: { amount: costs.shippingCost.value.toString(), currency: costs.shippingCost.currencyCode },
                taxAmount: { amount: costs.tax.value.toString(), currency: costs.tax.currencyCode },
                orderAmount: { amount: costs.totalCost.value.toString(), currency: costs.totalCost.currencyCode }
            }]);
            return;
        }
    }

    let paramMap = request.getHttpParameterMap();
    let reqBody = paramMap.getRequestBodyAsString();
    let addressIn = JSON.parse(reqBody);

    address = new TransientAddress();
    address.countryCode = addressIn.countryCode || '';
    address.stateCode = addressIn.state || '';
    address.postalCode = addressIn.postcode || '';
    address.city = addressIn.suburb || '';
    address.address1 = addressIn.address1 || '';
    address.address2 = addressIn.address2 || '';

    Logger.debug('GetShippingMethods: for address=' + address.address1 + ' postcode=' + address.postalCode);

    applicableShippingMethods = cart.getApplicableShippingMethods(address);
    // shippingCosts = new HashMap();
    currentShippingMethod = cart.getDefaultShipment().getShippingMethod() || ShippingMgr.getDefaultShippingMethod();

    let responseMethods = [];

    // Calculates shipping cost by updating each shipping method in the cart
    // and computing shipping and tax before rolling back
    Transaction.begin();

    for (i = 0; i < applicableShippingMethods.length; i++) {
        method = applicableShippingMethods[i];
        // skip in-store pickup shipping method
        if (method.custom.storePickupEnabled) {
            continue;
        }

        // copy in the shipping address to the basket to get tax/shipping rates
        COHelpers.addShippingAddressToBasket(cart.object, {
            name: '',
            line1: addressIn.address1 || '',
            line2: addressIn.address2 || '',
            area1: addressIn.suburb || '',
            postcode: addressIn.postcode || '',
            region: addressIn.state || '',
            countryCode: addressIn.countryCode || '',
            phone: ''
        });
        cart.updateShipmentShippingMethod(cart.getDefaultShipment().getID(), method.getID(), null, null);
        cart.calculate();

        // Logic from ordertotals.isml
        let totalCost = cart.object.totalGrossPrice.available ? cart.object.totalGrossPrice
                : cart.object.getAdjustedMerchandizeTotalPrice(true).add(cart.object.giftCertificateTotalPrice);
        let shipCost = cart.object.getAdjustedShippingTotalPrice();
        let taxAmount = new Money(0.0, cart.object.currencyCode);
        if (dw.order.TaxMgr.getTaxationPolicy() == dw.order.TaxMgr.TAX_POLICY_NET) {
            if (cart.object.totalTax.available) {
                taxAmount = cart.object.totalTax;
            }
        }
        responseMethods.push({
            id: method.getID(),
            name: method.displayName,
            description: method.description,
            shippingAmount: { amount: shipCost.value.toString(), currency: shipCost.currencyCode },
            taxAmount: { amount: taxAmount.value.toString(), currency: taxAmount.currencyCode },
            orderAmount: { amount: totalCost.value.toString(), currency: totalCost.currencyCode }
        });
    }

    Transaction.rollback();

    Transaction.wrap(function () {
        cart.updateShipmentShippingMethod(cart.getDefaultShipment().getID(), currentShippingMethod.getID(), currentShippingMethod, applicableShippingMethods);
        cart.calculate();
    });

    Logger.debug('All returned shipping options: ' + JSON.stringify(responseMethods));
    responseUtils.renderJSON(responseMethods);
}

/**
 * Run by onComplete.
 * for BuyNow, should retrieve order from Clearpay, verify amounts, create order in store, auth/capture, and show confirmation screen
 * for non-BuyNow, should retrieve order from Clearpay, populate cart with as much info as we received from portal, redirect to checkout screen
 * for deferred shipping, should retrieve order from Clearpay, populate cart with as much info as we received from portal, redirect to checkout screen
 */
function PostClearpayCheckoutFlow() {
    if (!clearpayEnabled) {
        Logger.error('Clearpay not enabled.');
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    } else if (!expressCheckoutEnabled) {
        Logger.error('Clearpay Express Checkout not enabled.');
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    }
    var cart = app.getModel('Cart').get();
    if (!cart) {
        Logger.error('Cart is empty.');
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    }

    var ArrayList = require('dw/util/ArrayList');

    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var ShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');

    var apOrderToken = ClearpaySession.getToken();
    // var merchantOrderNum = ClearpaySession.getMerchantReference();
    var redirectURL;

    if (!apOrderToken) {
        ClearpaySession.clearSession();
        Logger.error('Missing token from session.');
        redirectToErrorDisplay(Resource.msg('expresscheckout.error.invalidsession', brand, null));
        return;
    }

    // retrieve the order from Clearpay using api
    var clearPayOrderResponse = require('*/cartridge/scripts/checkout/clearpayGetOrder').GetOrder(apOrderToken);
    if (clearPayOrderResponse.error) {
        // responseUtils.renderJSON({ type: 'ProcessOrder', error: clearPayOrderResponse.errorMessage });
        Logger.error(clearPayOrderResponse.errorMessage);
        redirectToErrorDisplay(clearPayOrderResponse.errorMessage);
        return;
    }

    // Make sure the merchant reference returned by Clearpay is the same as what we stored in session during CreateToken
    // if (merchantOrderNum != clearPayOrderResponse.merchantReference) {
    //    redirectToErrorDisplay(Resource.msg('expresscheckout.error.checkout', brand, null));
    //    return;
    // }

    // billing is not always returned
    // if (! clearPayOrderResponse.consumer || ! clearPayOrderResponse.billing || ! clearPayOrderResponse.shipping) {
    if (!clearPayOrderResponse.consumer || !clearPayOrderResponse.shipping) {
        Logger.error('Missing data from Clearpay Get Order.');
        redirectToErrorDisplay(Resource.msg('expresscheckout.error.checkout', brand, null));
        return;
    }

    let expressCheckoutShippingStrategy = sitePreferences.getExpressCheckoutShippingStrategy();
    app.getController('COShipping').PrepareShipments();

    // If this is deferred shipping, just call DeferredFlow()
    if (expressCheckoutShippingStrategy == 'deferred') {
        return DeferredShippingFlow(clearPayOrderResponse);
    }

    return IntegratedShippingFlow(clearPayOrderResponse);
}


function DeferredShippingFlow(clearPayOrderResponse) {
    var Transaction = require('dw/system/Transaction');
    var ShippingHelpers = require('~/cartridge/scripts/checkout/clearpayShippingHelpers');

    var cart = app.getModel('Cart').get();
    if (!cart) {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({ type: 'DeferredShippingFlow', error: Resource.msg('expresscheckout.error.emptycart', brand, null) });
        return;
    }

    COHelpers.addShippingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
    ClearpaySession.setShippingChecksum(COHelpers.computeBasketShippingChecksum(cart.object));
    COHelpers.addConsumerToBasket(cart.object, clearPayOrderResponse.consumer);
    if (clearPayOrderResponse.billing) {
        COHelpers.addBillingAddressToBasket(cart.object, clearPayOrderResponse.billing);
    } else {
        // Use shipping address for billing if billing is not passed in
        COHelpers.addBillingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
    }

    app.getController('COShipping').PrepareShipments();
    let cartTotals = ShippingHelpers.calculateCartTaxShipTotals(cart);
    var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
    // Even though we do not know shipping cost yet, create the payment instrument
    // so billing screens will show Clearpay as the selected billing option.
    // We will change it later as amounts get updated.
    Transaction.wrap(function () {
        cart.calculate();
        // remove everything except gift certs
        COHelpers.removeAllNonGiftCertificatePayments(cart);
         let paymentInstrument = cart.object.createPaymentInstrument(paymentMethodName, new Money(0.0, cart.object.currencyCode));
        // will compute the amount for us for the payment instrument
        cart.calculatePaymentTransactionTotal();
    });
    // Prepopulate the billing form with Clearpay payment type
    app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.htmlValue = paymentMethodName;
    app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value = paymentMethodName;
    ClearpaySession.setExpressCheckoutFinalizeFlow(true);
    response.redirect(URLUtils.url('COShipping-Start'));
    return;
}

function IntegratedShippingFlow(clearPayOrderResponse) {
    var Transaction = require('dw/system/Transaction');
    var ShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');
    var apOrderToken = ClearpaySession.getToken();

    var newOrder = null;
    var cart = app.getModel('Cart').get();
    // Shipping option chosen by the consumer
    var selectedShipOption = clearPayOrderResponse.shippingOptionIdentifier;

    if (!cart) {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({ type: 'IntegratedShippingFlow', error: Resource.msg('expresscheckout.error.emptycart', brand, null) });
        return;
    }

    let isStorePickup = false;
    if (COHelpers.shouldEnableExpressPickupMode(cart)) {
        isStorePickup = true;
    }

    let adjustCartResponse = false;

    // For in-store pickup, the address will be the address of the store
    COHelpers.addShippingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
    ClearpaySession.setShippingChecksum(COHelpers.computeBasketShippingChecksum(cart.object));

    if (!isStorePickup) {
        // Need to compute the cost given the chosen shipping selection
        let shipMethod = ShippingHelpers.getShippingMethodForID(selectedShipOption);
        if (!shipMethod) {
            Logger.error('Shipping method returned by Clearpay was invalid.');
            redirectToErrorDisplay(Resource.msg('expresscheckout.error.checkout', brand, null));
            return;
        }
        ShippingHelpers.setCartShippingMethod(cart, shipMethod);
    } else {
        // Should we get the address of the store? Or if it's instore pickup, we will never send
        // Store a checksum of the line items into the session. Check this before we do a capture.
        ClearpaySession.setExpressCheckoutInstorePickup(true);
    }

    let cartTotals = ShippingHelpers.calculateCartTaxShipTotals(cart);
    COHelpers.addConsumerToBasket(cart.object, clearPayOrderResponse.consumer);

    if (clearPayOrderResponse.billing) {
        COHelpers.addBillingAddressToBasket(cart.object, clearPayOrderResponse.billing);
    } else {
        // Use shipping address for billing if billing is not passed in
        COHelpers.addBillingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
    }
    adjustCartResponse = { totalCost: cartTotals.totalCost };

    var amount = clearPayOrderResponse.amount.amount;
    var currency = clearPayOrderResponse.amount.currency;
    if ((adjustCartResponse.totalCost.value != amount) ||
        (adjustCartResponse.totalCost.currencyCode != currency)) {
        // this can occur if session was modified while express checkout was in flight
        Logger.error('Amount returned by Clearpay did not match expected amount. Clearpay returned=' + amount + currency + ' Merchant computed=' + adjustCartResponse.totalCost.value + adjustCartResponse.totalCost.currencyCode);
        redirectToErrorDisplay(Resource.msg('apierror.token.conflict', brand, null));
        return;
    }

    var buyNow = sitePreferences.isExpressCheckoutBuyNowEnabled();
    if (buyNow) {
        // needed so checkout thinks we're past billing stage
        session.forms.billing.fulfilled.value = true;
        // create the payment transaction with Clearpay for the desired amount
        Transaction.wrap(function () {
            COHelpers.removeAllNonGiftCertificatePayments(cart);

            var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
            cart.object.createPaymentInstrument(paymentMethodName, new Money(amount, currency));
            COHelpers.addShippingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
        });

        // puts initial state into paymentTransaction
        require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(cart.object, { status: 'SUCCESS', orderToken: apOrderToken, cpExpressCheckout: true });
        var redirectURL = '';
        // go into order placement flow
        try {
            // call entry point for order creation
            let placeOrderResult = app.getController('COPlaceOrder').Start();
            if (placeOrderResult.order_created) {
                app.getController('COSummary').ShowConfirmation(placeOrderResult.Order);
                return;
            } else if (placeOrderResult.error) {
                var error = !empty(placeOrderResult.clearpayOrderAuthorizeError) ? placeOrderResult.clearpayOrderAuthorizeError : Resource.msg('apierror.flow.default', brand, null);
                redirectURL = dw.web.URLUtils.https('COBilling-Start', 'clearpay', error);
            }
        } catch (e) {
            Logger.error('Exception occured while creating order :' + e);
            // Change error page later
            redirectURL = dw.web.URLUtils.https('COBilling-Start', 'clearpay', Resource.msg('apierror.flow.default', brand, null));
        }
        app.getView({
            ClearpayRedirectUrl: redirectURL
        }).render('checkout/redirect');
    } else {
        // Just copy in billing/shipping info, create Clearpay payment instrument, and go to checkout summary view
        // However, consumer can still modify anything, so will recreate as necessary
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
        Transaction.wrap(function () {
            COHelpers.removeAllNonGiftCertificatePayments(cart);

            let paymentInstrument = cart.object.createPaymentInstrument(paymentMethodName, new Money(amount,currency));
            COHelpers.addShippingAddressToBasket(cart.object, clearPayOrderResponse.shipping);
        });
        // Prepopulate the billing form with Clearpay payment type
        app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.htmlValue = paymentMethodName;
        app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value = paymentMethodName;

        ClearpaySession.setExpressCheckoutFinalizeFlow(true);
        // Need this so checkout thinks we've filled in billing info (which we have automatically)
        session.forms.billing.fulfilled.value = true;

        // puts initial state into paymentTransaction
        require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(cart.object, { status: 'SUCCESS', orderToken: apOrderToken, cpExpressCheckout: true });

        // redirect to order review
        response.redirect(URLUtils.https('COSummary-Start'));
        return;
    }
}


function ContinueFinalize() {
    if (!clearpayEnabled || !expressCheckoutEnabled || !ClearpaySession.isExpressCheckoutFinalizeFlow()) {
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    }

    // Check if we need to add a product to the cart. This is to support the Clearpay Express Checkout
    // button on a product details page (during the Express Checkout finalize flow)
    let action = request.httpParameterMap.cartAction;
    if (action && action.stringValue === 'add') {
        var cart = app.getModel('Cart').goc();
        // Note: we are calling addProductToCart the same way it would normally be called from Cart-AddProduct.
        // addProductToCart will read the current request's httpParameterMap, so we just have to make sure we're
        // being called the same way as Cart-AddProduct
        cart.addProductToCart();
    }

    var cart = app.getModel('Cart').get();
    if (!cart) {
        ClearpaySession.clearSession();
        responseUtils.renderJSON({ type: 'ContinueFinalize', error: Resource.msg('expresscheckout.error.emptycart', brand, null) });
        return;
    }

    // The cart may have changed so need to call this before calculating the total payment.
    app.getController('COShipping').PrepareShipments();

    var Transaction = require('dw/system/Transaction');
    var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
    Transaction.wrap(function () {
        COHelpers.removeAllNonGiftCertificatePayments(cart);
        let paymentInstrument = cart.object.createPaymentInstrument(paymentMethodName, new Money(0.0, cart.object.currencyCode));
        cart.calculatePaymentTransactionTotal();
    });
    // Prepopulate the billing form with Clearpay payment type
    app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.htmlValue = paymentMethodName;
    app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value = paymentMethodName;
    session.forms.billing.fulfilled.value = true;

    // redirect to order review
    response.redirect(URLUtils.https('COSummary-Start'));
    return;
}


/**
 * This is called for deferred shipping and integrated shipping with no Buy-Now option.
 * It handles the final "Place order with Clearpay" button.
 *
 * Basically, we need to capture with the widget checksum and the
 * diff amount from the original checkout. This means we need to create a
 * payment transaction with those included as tags, so that
 * the capturing logic has that
 */
function FinalizeOrder() {
    if (!clearpayEnabled || !expressCheckoutEnabled) {
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    }
    var cart = app.getModel('Cart').get();
    if (!cart) {
        response.redirect(URLUtils.https('Cart-Show'));
        return;
    }

    if (!ClearpaySession.isExpressCheckoutFinalizeFlow()) {
        // This should only be run during a express checkout finalize flow.
        // session may have timed out
        ClearpaySession.clearSession();
        redirectToErrorDisplay(Resource.msg('expresscheckout.error.notfinalizeflow', brand, null));
        return;
    }

    var ShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');
    var redirectURL;

    var apOrderToken = ClearpaySession.getToken();

    let parameterMap = request.getHttpParameterMap();
    let widgetChecksum = parameterMap.checksum.stringValue;

    // run PrepareShipments again in case cart has changed
    app.getController('COShipping').PrepareShipments();

    Transaction.wrap(function () {
        COHelpers.removeAllNonGiftCertificatePayments(cart);
        var paymentMethodName = apCheckoutUtilities.getPaymentMethodName();
        let paymentInstrument = cart.object.createPaymentInstrument(paymentMethodName, new Money(0.0, cart.object.currencyCode));
        // will compute the amount for us for the payment instrument
        cart.calculatePaymentTransactionTotal();
    });


    // needed so checkout thinks we're past billing stage
    session.forms.billing.fulfilled.value = true;
    require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(cart.object, { status: 'SUCCESS', orderToken: apOrderToken, cpExpressCheckout: true, cpExpressCheckoutChecksum: widgetChecksum });

    // go into order placement flow
    try {
        let placeOrderResult = app.getController('COPlaceOrder').Start();
        if (placeOrderResult.order_created) {
            app.getController('COSummary').ShowConfirmation(placeOrderResult.Order);
            return;
        } else if (placeOrderResult.error) {
            var error = !empty(placeOrderResult.clearpayOrderAuthorizeError) ? placeOrderResult.clearpayOrderAuthorizeError : Resource.msg('apierror.flow.default', brand, null);
            redirectURL = dw.web.URLUtils.https('COBilling-Start', 'clearpay', error);
        }
    } catch (e) {
        Logger.error('Exception occured while creating order :' + e);
        // Change error page later
        redirectURL = dw.web.URLUtils.https('ClearpayExpress-CancelOrder', 'error', JSON.stringify(e));
    }
    app.getView({
        ClearpayRedirectUrl: redirectURL
    }).render('checkout/redirect');
}

function CancelOrder() {
    var apOrderToken = ClearpaySession.getToken();
    ClearpaySession.clearSession();

    Logger.debug('Order canceled. apOrderToken=' + apOrderToken);
    response.redirect(URLUtils.https('Cart-Show'));
}

function WidgetError() {
    let error = request.httpParameterMap.error || '';
    ClearpaySession.clearSession();
    redirectToErrorDisplay(error);
}


/*
* Calls Clearpay's "create checkout" and species "express checkout" mode
*/
exports.CreateToken = guard.ensure(['https'], CreateToken);
/*
* Called by the onCommenceCheckout() handler in the express checkout popup
* so merchant site can pass shipping options and prices (shipping/tax/total)
*/
exports.GetShippingMethods = guard.ensure(['https'], GetShippingMethods);

/*
* Called by onComplete() handler in the express checkout popup.
*/
exports.PostClearpayCheckoutFlow = guard.ensure(['https'], PostClearpayCheckoutFlow);

/*
* Cancels the current order. Removes express checkout related session state
*/
exports.CancelOrder = guard.ensure(['https'], CancelOrder);
/*
* When the consumer is in the Clearpay Express finalization steps, use ContinueFinalize
* for the checkout buttons to get straight to the summary page.
*/
exports.ContinueFinalize = guard.ensure(['https'], ContinueFinalize);
/*
* When the consumer is in the Clearpay Express finalization steps, use FinalizeOrder
* to start the order creation process and payment process.
*/
exports.FinalizeOrder = guard.ensure(['https'], FinalizeOrder);
/*
* Webservice that checks cart and returns flag indicating whether the
* cart qualifies for in-store-pickup
*/
exports.CartStatus = guard.ensure(['https'], CartStatus);
/*
* Called specifically by the Clearpay Widget when isValid==false
*/
exports.WidgetError = guard.ensure(['https'], WidgetError);


// Just for debugging.
exports.DebugOrder = guard.ensure(['https'], DebugOrder);
