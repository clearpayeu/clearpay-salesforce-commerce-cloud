'use strict';

var server = require('server');
var parsePrice = require('~/cartridge/scripts/util/parsePriceClearpay.js');
var Response = require('server/response');
var URLUtils = require('dw/web/URLUtils');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');
var ClearpayRefArchCOHelpers = require('~/cartridge/scripts/checkout/clearpayRefArchCheckoutHelpers');
var Resource = require('dw/web/Resource');
let ClearpaySession = require('*/cartridge/scripts/util/clearpaySession');
let ValidationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
var BasketMgr = require('dw/order/BasketMgr');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayExpress');
var ClearpayShippingHelpers = require('*/cartridge/scripts/checkout/clearpayShippingHelpers');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Money = require('dw/value/Money');
var Transaction = require('dw/system/Transaction');
var cpUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
var cpBrandUtilities = cpUtilities.brandUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var sitePreferences = cpUtilities.sitePreferencesUtilities;
var clearpayEnabled = sitePreferences.isClearpayEnabled();
var expressCheckoutEnabled = sitePreferences.isExpressCheckoutEnabled();

function returnJsonError(res, next, err) {
    res.json({
        status: 'FAILURE',
        error: err,
        redirectUrl: URLUtils.url('Cart-Show').toString()
    });
    return next();
}

function redirectToErrorDisplay(res, error) {
    ClearpaySession.clearSession();
    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', error));
}

function deferredShippingFlow(req, res, next, clearPayOrderResponse) {
    var currentBasket = BasketMgr.getCurrentBasket();

    ClearpayRefArchCOHelpers.addShippingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
    ClearpaySession.setShippingChecksum(ClearpayCOHelpers.computeBasketShippingChecksum(currentBasket));
    ClearpayCOHelpers.addConsumerToBasket(currentBasket, clearPayOrderResponse.consumer);
    if (clearPayOrderResponse.billing) {
        ClearpayCOHelpers.addBillingAddressToBasket(currentBasket, clearPayOrderResponse.billing);
    } else {
        // Use shipping address for billing if billing is not passed in
        ClearpayCOHelpers.addBillingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
    }

    // Recreate the payment instrument in case session changed
    Transaction.wrap(function () {
        ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
        var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
        currentBasket.createPaymentInstrument(paymentMethodName, new Money(0.0, currentBasket.currencyCode));
    });

    ClearpayRefArchCOHelpers.calculateAndSetPaymentAmount(currentBasket);
    ClearpaySession.setExpressCheckoutFinalizeFlow(true);
    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'shipping'));
    return next();
}

function integratedShippingFlow(req, res, next, clearPayOrderResponse) {
    var currentBasket = BasketMgr.getCurrentBasket();

    var cpOrderToken = ClearpaySession.getToken();
    // Shipping option chosen by the consumer
    var selectedShipOption = clearPayOrderResponse.shippingOptionIdentifier;

    let isStorePickup = false;
    if (ClearpayRefArchCOHelpers.shouldEnableExpressPickupMode(currentBasket)) {
        isStorePickup = true;
    }

    // For in-store pickup, the address will be the address of the store
    ClearpayRefArchCOHelpers.addShippingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
    ClearpaySession.setShippingChecksum(ClearpayCOHelpers.computeBasketShippingChecksum(currentBasket));

    if (!isStorePickup) {
        // Need to compute the cost given the chosen shipping selection
        let shipMethod = ClearpayShippingHelpers.getShippingMethodForID(selectedShipOption);
        if (!shipMethod) {
            Logger.error('Shipping method returned by Clearpay was invalid.');
            redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.checkout', 'clearpay', null));
            return next();
        }
        ClearpayShippingHelpers.setBasketShippingMethod(currentBasket, shipMethod.ID);
    } else {
        // Should we get the address of the store? Or if it's instore pickup, we will never send
        // Store a checksum of the line items into the session. Check this before we do a capture.
        ClearpaySession.setExpressCheckoutInstorePickup(true);
    }
    let cartTotals = ClearpayShippingHelpers.calculateBasketTaxShipTotals(req, currentBasket);
    ClearpayCOHelpers.addConsumerToBasket(currentBasket, clearPayOrderResponse.consumer);

    if (clearPayOrderResponse.billing) {
        ClearpayCOHelpers.addBillingAddressToBasket(currentBasket, clearPayOrderResponse.billing);
    } else {
        // Use shipping address for billing if billing is not passed in
        ClearpayCOHelpers.addBillingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
    }
    var adjustCartResponse = { totalCost: cartTotals.totalCost };

    var amount = clearPayOrderResponse.amount.amount;
    var currency = clearPayOrderResponse.amount.currency;
    if ((adjustCartResponse.totalCost.value != amount) ||
        (adjustCartResponse.totalCost.currencyCode != currency)) {
        // this can occur if session was modified while express checkout was in flight
        Logger.error('Amount returned by Clearpay did not match expected amount. Clearpay returned=' + amount + currency + ' Merchant computed=' + adjustCartResponse.totalCost.value + adjustCartResponse.totalCost.currencyCode);
        redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.amountMismatch', 'clearpay', null));
        return next();
    }

    var buyNow = sitePreferences.isExpressCheckoutBuyNowEnabled();
    if (buyNow) {
        // create the payment transaction with Clearpay for the desired amount
        Transaction.wrap(function () {
            ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
            var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
            var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
            currentBasket.createPaymentInstrument(paymentMethodName, new Money(amount, currency));
            ClearpayRefArchCOHelpers.addShippingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
        });
        // puts initial state into paymentTransaction
        require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(currentBasket, { status: 'SUCCESS', orderToken: cpOrderToken, cpExpressCheckout: true });

        // Place the order
        // This logic is similar to ClearpayRedirect-HandleResponse, which is what gets called after Clearpay redirect flow returns to site
        var order = COHelpers.createOrder(currentBasket);
        // auth/capture payment
        let paymentStatusUpdated = require('*/cartridge/scripts/checkout/updatePaymentStatus').handlePaymentStatus(order);
        if (paymentStatusUpdated.authorized) {
            Transaction.begin();
            var orderPlacementStatus = OrderMgr.placeOrder(order);
            Transaction.commit();
            if (!orderPlacementStatus.error) {
                Transaction.begin();
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                order.setExportStatus(Order.EXPORT_STATUS_READY);
                Transaction.commit();
                res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'token', order.orderToken));
            } else {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, false);
                });
                res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', Resource.msg('order.submission.error', 'clearpay', null)));
            }
        } else {
            Transaction.wrap(function () {
                OrderMgr.failOrder(order);
            });
            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', paymentStatusUpdated.ClearpayOrderErrorMessage ? paymentStatusUpdated.ClearpayOrderErrorMessage : Resource.msg('apierror.flow.default', 'clearpay', null)));
        }
        return next();
    }
    Transaction.wrap(function () {
        ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
        var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
        currentBasket.createPaymentInstrument(paymentMethodName, new Money(amount, currency));
        ClearpayRefArchCOHelpers.addShippingAddressToBasket(currentBasket, clearPayOrderResponse.shipping);
    });
    ClearpaySession.setExpressCheckoutFinalizeFlow(true);
        // puts initial state into paymentTransaction
    require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(currentBasket, { status: 'SUCCESS', orderToken: cpOrderToken, cpExpressCheckout: true });
    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'placeOrder'));
    return next();
}

server.get('ContinueFinalize',
        server.middleware.https,
        function (req, res, next) {
            if (!clearpayEnabled || !expressCheckoutEnabled || !ClearpaySession.isExpressCheckoutFinalizeFlow()) {
                res.redirect(URLUtils.url('Cart-Show'));
                return next();
            }
            var currentBasket = BasketMgr.getCurrentBasket();
            if (!currentBasket || currentBasket.allLineItems.length === 0) {
                res.redirect(URLUtils.url('Cart-Show'));
                return next();
            }
            Transaction.wrap(function () {
                ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
                var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
                var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
                currentBasket.createPaymentInstrument(paymentMethodName, new Money(0.0, currentBasket.currencyCode));
            });
            // This does a recalculation using the current basket
            ClearpayRefArchCOHelpers.calculateAndSetPaymentAmount(currentBasket);
            let payAmt = ClearpayCOHelpers.getCurrentClearpayPaymentAmount(currentBasket);
            if (!ClearpayCOHelpers.isPriceWithinThreshold(payAmt)) {
                var brand = cpBrandUtilities.getBrand();
                var threshold = thresholdUtilities.getThresholdAmounts(brand);
                redirectToErrorDisplay(res, Resource.msgf('minimum.threshold.message', 'clearpay', null, new Money(threshold.minAmount, currentBasket.currencyCode)
                , new Money(sitePreferences.maxAmount, currentBasket.currencyCode)));
                return next();
            }

            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'placeOrder'));
            return next();
        }
);

server.get('FinalizeOrder',
        server.middleware.https,
        function (req, res, next) {
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

            var widgetChecksum = req.querystring.checksum;

            var currentBasket = BasketMgr.getCurrentBasket();
            if (!currentBasket || currentBasket.allLineItems.length === 0) {
                redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.emptycart', 'clearpay', null));
                return next();
            }
            if (!ClearpaySession.isExpressCheckoutFinalizeFlow()) {
                // This should only be run during a express checkout finalize flow.
                // session may have timed out
                ClearpaySession.clearSession();
                // Can we call the old checkout here?
                redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.notfinalizeflow', 'clearpay', null));
                return next();
            }
            let cpOrderToken = ClearpaySession.getToken();

            if (!widgetChecksum) {
                redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.missingchecksum', 'clearpay', null));
                return next();
            }
            // Get logic from CheckoutServices-PlaceOrder . can't call it directly due to widgetchecksum stuff

            // Recreate the payment instrument in case session changed
            Transaction.wrap(function () {
                ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
                var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
                var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
                currentBasket.createPaymentInstrument(paymentMethodName, new Money(0.0, currentBasket.currencyCode));
            });
            ClearpayRefArchCOHelpers.calculateAndSetPaymentAmount(currentBasket);

            // Re-calculate the payments.
            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );
            if (calculatedPaymentTransaction.error) {
                redirectToErrorDisplay(res, Resource.msg('error.technical', 'checkout', null));
                return next();
            }

            require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(currentBasket, { status: 'SUCCESS', orderToken: cpOrderToken, cpExpressCheckout: true, cpExpressCheckoutChecksum: widgetChecksum });

            // Place order and show confirmation. What's the best way? Can we return to checkout.isml? Or probably just directly

            // This logic is similar to ClearpayRedirect-HandleResponse, which is what gets called after Clearpay redirect flow returns to site
            var order = COHelpers.createOrder(currentBasket);
            // auth/capture payment
            let paymentStatusUpdated = require('*/cartridge/scripts/checkout/updatePaymentStatus').handlePaymentStatus(order);
            if (paymentStatusUpdated.authorized) {
                Transaction.begin();
                var orderPlacementStatus = OrderMgr.placeOrder(order);
                Transaction.commit();
                if (!orderPlacementStatus.error) {
                    Transaction.begin();
                    order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                    order.setExportStatus(Order.EXPORT_STATUS_READY);
                    Transaction.commit();
                    res.redirect(URLUtils.url('Order-Confirm', 'ID', order.orderNo, 'token', order.orderToken));
                } else {
                    Transaction.wrap(function () {
                        OrderMgr.failOrder(order, false);
                    });
                    res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', Resource.msg('order.submission.error', 'clearpay', null)));
                }
            } else {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order);
                });
                res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', paymentStatusUpdated.ClearpayOrderErrorMessage ? paymentStatusUpdated.ClearpayOrderErrorMessage : Resource.msg('apierror.flow.default', 'clearpay', null)));
            }
            ClearpaySession.clearSession();
            return next();
        }
);


server.get('WidgetError',
        server.middleware.https,
        function (req, res, next) {
            ClearpaySession.clearSession();
            let error = req.querystring.error || '';
            redirectToErrorDisplay(res, error);
            return next();
        }
);

/**
 * Called by Express Checkout widget when onComplete() is called with a fail status.
 * Also called by the widget when token creation fails.
 */
server.get('CancelOrder',
        server.middleware.https,
        function (req, res, next) {
            var cpOrderToken = ClearpaySession.getToken();
            ClearpaySession.clearSession();
            if (req.querystring.clearpayerror) {
                res.redirect(URLUtils.url('Cart-Show', 'clearpayerror', req.querystring.clearpayerror));
            } else {
                res.redirect(URLUtils.url('Cart-Show'));
            }
            return next();
        }
);

server.get('Debug',
        server.middleware.https,
        function (req, res, next) {
            var currentBasket = BasketMgr.getCurrentBasket();
            ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);

            let cartTotals = ClearpayShippingHelpers.calculateBasketTaxShipTotals(req, currentBasket);
            return next();
        }
);

server.get('CartStatus',
        server.middleware.https,
        function (req, res, next) {
            if (!clearpayEnabled || !expressCheckoutEnabled) {
                res.json({});
                return next();
            }
            var currentBasket = BasketMgr.getCurrentBasket();
            if (!currentBasket) {
                res.json({});
                return next();
            }

            let cartTotals = ClearpayShippingHelpers.calculateBasketTaxShipTotals(req, currentBasket);
            res.json({ cartTotalAmount: cartTotals.totalCost.value,
                cartTotalCurrency: cartTotals.totalCost.currencyCode,
                withinThreshold: ClearpayCOHelpers.isBasketAmountWithinThreshold(),
                instorepickup: ClearpayRefArchCOHelpers.shouldEnableExpressPickupMode(currentBasket),
                expressCheckoutFinalize: ClearpaySession.isExpressCheckoutFinalizeFlow()
            });
            return next();
        }
);

server.get('GetShippingRequired',
        server.middleware.https,
        function (req, res, next) {
            if (!clearpayEnabled || !expressCheckoutEnabled) {
                res.json({});
                return next();
            }

            var clearpayShipmentType = '';
            var currentBasket = BasketMgr.getCurrentBasket();
            if (currentBasket) {
                clearpayShipmentType = ClearpayRefArchCOHelpers.getCartShipmentType(currentBasket)
            }
           
            res.json({
                shipmentType: clearpayShipmentType 
            });
            
            return next();
        }
);

server.get('CreateToken',
        server.middleware.https,
        function (req, res, next) {
            var OrderModel = require('*/cartridge/models/order');
            var Locale = require('dw/util/Locale');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
            var currentBasket = BasketMgr.getCurrentBasket();
            var currentLocale = Locale.getLocale(req.locale.id);
            var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');

            let sourceUrl = req.form.s_url;

            if (!currentBasket || currentBasket.allLineItems.length === 0) {
                return returnJsonError(res, next, Resource.msg('expresscheckout.error.emptycart', 'clearpay', null));
            }

            var basketModel = null;

            var validatedProducts = ValidationHelpers.validateProducts(currentBasket);
            if (validatedProducts.error) {
                return returnJsonError(res, next, 'Problem with basket');
            }

            COHelpers.recalculateBasket(currentBasket);

            basketModel = new OrderModel(
                currentBasket,
                { usingMultiShipping: false, countryCode: currentLocale.country, containerView: 'basket' }
            );

            let grandTotal = parsePrice(basketModel.totals.grandTotal);
            let checkoutPrice = new Money(grandTotal, currentBasket.currencyCode);
            var isWithinThreshold = thresholdUtilities.checkThreshold(checkoutPrice);
            if (!isWithinThreshold.status) {
                return returnJsonError(res, next, Resource.msg('expresscheckout.error.invalidamount', 'clearpay', null));
            }

        // Get a map of storeId -> store .
        let storeMap = ClearpayCOHelpers.getInStorePickupsMap(currentBasket);
        let store = null;
        var shipmentType =  ClearpayRefArchCOHelpers.getCartShipmentType(currentBasket);
        var expressCheckoutSplitShipment = false;
        // Make sure everything is only going to a single store and there are no home deliveries.
        // If so, we use in-store pickup mode for express checkout
        if(!empty(shipmentType)){
            if(shipmentType !='SingleStorePickup'){
                expressCheckoutSplitShipment = true
            }
            for (var key in storeMap) {
                store = storeMap[key];
            }
        }

        // merchantnum is currently unused. Just pass in a "x"
        // var merchantOrderNum = Math.random().toString(36).substring(2, 15);
            var merchantOrderNum = 'x';
            var clearPayTokenResponse = require('*/cartridge/scripts/checkout/clearpayExpressGetToken').getExpressToken(currentBasket, checkoutPrice, sourceUrl, merchantOrderNum, store);
            if (clearPayTokenResponse.error) {
                return returnJsonError(res, next, Resource.msg('expresscheckout.error.gettoken', 'clearpay', null));
            }
            var orderToken = clearPayTokenResponse.cpToken;
            if (!orderToken) {
                return returnJsonError(res, next, Resource.msg('expresscheckout.error.gettoken', 'clearpay', null));
            }

        // Create the payment instrument
            Transaction.wrap(function () {
                ClearpayRefArchCOHelpers.removeAllNonGiftCertificatePayments(currentBasket);
                var cpCheckoutUtilities = cpUtilities.checkoutUtilities;
                var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
                currentBasket.createPaymentInstrument(paymentMethodName, checkoutPrice);
            });

            ClearpaySession.newSession(orderToken);
            ClearpaySession.setExpressCheckout(true);
            ClearpaySession.setMerchantReference(merchantOrderNum);
            ClearpaySession.setExpressCheckoutAmount(checkoutPrice.value);
            ClearpaySession.setExpressCheckoutCurrency(checkoutPrice.currencyCode);
            ClearpaySession.setItemsChecksum(ClearpayCOHelpers.computeBasketProductLineItemChecksum(currentBasket));
            ClearpaySession.setIsSplitShipment(expressCheckoutSplitShipment);

            res.json({ status: 'SUCCESS', token: clearPayTokenResponse, merchantRef: merchantOrderNum });
            return next();
        }
);

// Mainly getting logic from CheckoutShippingServices-UpdateShippingMethodsList
server.post('GetShippingMethods',
        server.middleware.https,
        function (req, res, next) {
            var OrderModel = require('*/cartridge/models/order');
            var Locale = require('dw/util/Locale');
            var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
            var TotalsModel = require('*/cartridge/models/totals');
            var currentBasket = BasketMgr.getCurrentBasket();
            var responseMethods = [];

            if (!currentBasket) {
                res.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });
                return next();
            }


            if (ClearpayRefArchCOHelpers.shouldEnableExpressPickupMode(currentBasket)) {
            // if this is a store pickup, just get the store name
                let storeMap = ClearpayCOHelpers.getInStorePickupsMap(currentBasket);
                let store = null;
                var key = null;
                for (key in storeMap) {
                    store = storeMap[key];
                }
                if (store) {
                // The cart should only have in-store pickup items at this point
                    let costs = ClearpayShippingHelpers.calculateBasketTaxShipTotals(req, currentBasket);
                    res.json({ shipmethods: [{
                        id: store.ID,
                        name: store.name,
                        description: sitePreferences.getStorePickupDescription(),
                        shippingAmount: { amount: costs.shippingCost.value.toString(), currency: costs.shippingCost.currencyCode },
                        taxAmount: { amount: costs.tax.value.toString(), currency: costs.tax.currencyCode },
                        orderAmount: { amount: costs.totalCost.value.toString(), currency: costs.totalCost.currencyCode }
                    }]
                    });
                    return next();
                }
            }

            let shipment = currentBasket.defaultShipment;

        // If there's a shipping method set already, just default to that initially
        // There is always a default
            var shippingMethodID;
            if (shipment.shippingMethod) {
                shippingMethodID = shipment.shippingMethod.ID;
            }

            let address = {};
            address.countryCode = req.form.countryCode || '';
            address.stateCode = req.form.state || '';
            address.postalCode = req.form.postcode || '';
            address.city = req.form.suburb || '';
            address.address1 = req.form.address1 || '';
            address.address2 = req.form.address2 || '';

            Transaction.wrap(function () {
                var shippingAddress = shipment.shippingAddress;

                if (!shippingAddress) {
                    shippingAddress = shipment.createShippingAddress();
                }

                shippingAddress.setFirstName(address.firstName || '');
                shippingAddress.setLastName(address.lastName || '');
                shippingAddress.setAddress1(address.address1 || '');
                shippingAddress.setAddress2(address.address2 || '');
                shippingAddress.setCity(address.city || '');
                shippingAddress.setPostalCode(address.postalCode || '');
                shippingAddress.setStateCode(address.stateCode || '');
                shippingAddress.setCountryCode(address.countryCode || '');
                shippingAddress.setPhone(address.phone || '');

                ShippingHelper.selectShippingMethod(shipment, shippingMethodID);
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            var currentLocale = Locale.getLocale(req.locale.id);

            var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: false, countryCode: currentLocale.country, containerView: 'basket' }
        );

            var applicableShippingMethods = basketModel.shipping[0].applicableShippingMethods;


        // Calculates shipping cost by updating each shipping method in the cart
        // and computing shipping and tax before rolling back
        // Some logic from CheckoutShippingServices
            for (var i = 0; i < applicableShippingMethods.length; i++) {
                let method = applicableShippingMethods[i];
                if (method.storePickupEnabled) {
                    continue;
                }
                try {
                    Transaction.wrap(function () {
                        ShippingHelper.selectShippingMethod(shipment, method.ID);

                        basketCalculationHelpers.calculateTotals(currentBasket);

                        var innerModel = new OrderModel(
                        currentBasket,
                        { usingMultiShipping: false, countryCode: address.countryCode, containerView: 'basket' }
                        );
                        
                        responseMethods.push({
                            id: method.ID,
                            name: method.displayName,
                            description: method.description,
                            shippingAmount: { amount: parsePrice(innerModel.totals.totalShippingCost).toString(), currency: currentBasket.currencyCode },
                            taxAmount: { amount: parsePrice(innerModel.totals.totalTax).toString(), currency: currentBasket.currencyCode },
                            orderAmount: { amount: parsePrice(innerModel.totals.grandTotal).toString(), currency: currentBasket.currencyCode }
                        });
                    });
                } catch (err) {
                    res.setStatusCode(500);
                    res.json({
                        error: true,
                        errorMessage: Resource.msg('error.cannot.select.shipping.method', 'cart', null)
                    });

                    return;
                }
            }
            res.json({ shipmethods: responseMethods });
            return next();
        }
);

server.get('PostClearpayCheckoutFlow',
        server.middleware.https,
        function (req, res, next) {
            if (!clearpayEnabled) {
                Logger.error('Clearpay not enabled.');
                res.redirect(URLUtils.url('Cart-Show'));
                return next();
            } else if (!expressCheckoutEnabled) {
                Logger.error('Clearpay Express Checkout not enabled.');
                res.redirect(URLUtils.url('Cart-Show'));
                return next();
            }

            var currentBasket = BasketMgr.getCurrentBasket();
            if (!currentBasket) {
                Logger.error('Cart is empty.');
                res.redirect(URLUtils.url('Cart-Show'));
                return next();
            }

            var cpOrderToken = ClearpaySession.getToken();
            if (!cpOrderToken) {
                ClearpaySession.clearSession();
                Logger.error('Missing token from session.');
                redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.invalidsession', 'clearpay', null));
                return next();
            }

            // retrieve the order from Clearpay using api
            var clearPayOrderResponse = require('*/cartridge/scripts/util/getOrderToken').validateOrderToken(cpOrderToken);
            if (clearPayOrderResponse.error) {
                Logger.error(clearPayOrderResponse.errorMessage || 'Unable to verify order token');
                redirectToErrorDisplay(res, clearPayOrderResponse.errorMessage || Resource.msg('expresscheckout.error.gettoken', 'clearpay', null));
                return next();
            }
            if (!clearPayOrderResponse.consumer || !clearPayOrderResponse.shipping) {
                Logger.error('Missing data from Clearpay Get Order.');
                redirectToErrorDisplay(res, Resource.msg('expresscheckout.error.checkout', 'clearpay', null));
                return next();
            }

            var expressCheckoutShippingStrategy = sitePreferences.getExpressCheckoutShippingStrategy();

            if((!empty(ClearpaySession.getIsSplitShipment()) && ClearpaySession.getIsSplitShipment())){
                expressCheckoutShippingStrategy = "deferred";
            }

           // If this is deferred shipping, just call DeferredFlow()
            if (expressCheckoutShippingStrategy == 'deferred') {
                return deferredShippingFlow(req, res, next, clearPayOrderResponse);
            }

            return integratedShippingFlow(req, res, next, clearPayOrderResponse);
        }
);

module.exports = server.exports();
