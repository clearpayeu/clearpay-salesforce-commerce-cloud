'use strict';

var server = require('server');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var LogUtils = require('*/cartridge/scripts/util/clearpayLogUtils');
var Logger = LogUtils.getLogger('ClearpayRedirect');
var {
         brandUtilities: cpBrandUtilities,
         checkoutUtilities: cpCheckoutUtilities
     } = require('*/cartridge/scripts/util/clearpayUtilities');

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var URLUtils = require('dw/web/URLUtils');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var BasketMgr = require('dw/order/BasketMgr');


/**
 * redirects to Clearpay payment page after generating valid token
 */
server.get('PrepareRedirect', server.middleware.https, function (req, res, next) {
    var clearPayToken = decodeURIComponent(req.querystring.clearpayToken);
    var errorMessage = req.querystring.errorMessage;
    var errorCode = req.querystring.errorCode;
    var invalidEmailError = Resource.msg('clearpay.email.invalid.response', 'clearpay', null);

    var cpBrand = cpBrandUtilities.getBrand();
    var scriptURL = cpBrandUtilities.getBrandSettings().javaScriptUrl;
    var countryCodeValue = cpBrandUtilities.getCountryCode();

    if ((clearPayToken !== 'undefined') && countryCodeValue) {
        res.render('checkout/clearpayRedirect', {
            cpBrand: cpBrand,
            cpJavascriptURL: scriptURL,
            cpToken: clearPayToken,
            countryCode: countryCodeValue
        });
    } else {
        var tokenErrorMessage;

        if (invalidEmailError.equals(errorMessage)) {
            tokenErrorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses('TOKEN_ERROR');
        } else {
            tokenErrorMessage = require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(errorCode);
        }
        Logger.error('Error while generating Token: ' + tokenErrorMessage);

        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage',
            require('*/cartridge/scripts/util/clearpayErrors').getErrorResponses(errorCode, true)));
    }
    next();
});


/** saves clearpay payment method in payment instrument */
server.post('IsClearpay',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();
        var cpBrand = cpBrandUtilities.getBrand();
        var currentBasket = BasketMgr.getCurrentBasket();
        var paymentInstexists = false;
        var clearpayInstruments = currentBasket.getPaymentInstruments(paymentMethodName);
        var paymentInstruments = currentBasket.getPaymentInstruments();

        if (clearpayInstruments.length > 0 && clearpayInstruments.length === paymentInstruments.length) {
            paymentInstexists = true;
        } else {
            Transaction.wrap(function () {
                currentBasket.createPaymentInstrument(
                    paymentMethodName, currentBasket.totalGrossPrice
                );
            });
            paymentInstexists = true;
        }

        res.json({
            isClearpay: paymentInstexists,
            resource: {
                pleaseWait: Resource.msg('redirect.message', cpBrand, null),
                redirectMessage: Resource.msg('redirect.notification', cpBrand, null)
            }
        });
        return next();
    });

/** processes request and retrieves token */
server.post('Redirect',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                cartUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        if (req.session.privacyCache.get('fraudDetectionStatus')) {
            res.json({
                error: true,
                cartError: true,
                cartUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }
        var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
        if (validationOrderStatus.error) {
            res.json({
                error: true,
                errorMessage: validationOrderStatus.message
            });
            return next();
        }

        // Check to make sure there is a shipping address
        if (currentBasket.defaultShipment.shippingAddress === null) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'shipping',
                    step: 'address'
                },
                errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
            });
            return next();
        }

        // Check to make sure billing address exists
        if (!currentBasket.billingAddress) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'billingAddress'
                },
                errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
            });
            return next();
        }

        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        // Re-validates existing payment instruments
        var validPayment = COHelpers.validatePayment(req, currentBasket);
        if (validPayment.error) {
            res.json({
                error: true,
                errorStage: {
                    stage: 'payment',
                    step: 'paymentInstrument'
                },
                errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
            });
            return next();
        }

        // Re-calculate the payments.
        var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
        if (calculatedPaymentTransactionTotal.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }
        var redirectUrl = URLUtils.https('ClearpayRedirect-PrepareRedirect').toString();
        var clearPayTokenResponse = require('*/cartridge/scripts/checkout/clearpayGetToken').getToken(currentBasket);
        var countryCode = currentBasket.billingAddress.countryCode ? currentBasket.billingAddress.countryCode.value.toUpperCase() : '';
        res.json({
            error: false,
            redirectTokenResponse: clearPayTokenResponse,
            countryCode: countryCode,
            redirectUrl: redirectUrl
        });
        return next();
    });

/**
* processes the response returned by clearpay once the payment is done
*/
server.get('HandleResponse', server.middleware.https, function (req, res, next) {
    var Order = require('dw/order/Order');
    var productExists;
    var orderPlacementStatus;
    var paymentStatusUpdated;
    var paymentStatus = req.querystring.status;
    var currentBasket = BasketMgr.getCurrentBasket();
    switch (paymentStatus) {
        case 'SUCCESS':
            productExists = require('*/cartridge/scripts/checkout/clearpayTokenConflict').checkTokenConflict(currentBasket, req.querystring.orderToken);
            require('*/cartridge/scripts/checkout/clearpayUpdatePreapprovalStatus').getPreApprovalResult(currentBasket, req.querystring);
            if (!productExists || productExists.error) {
                res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', Resource.msg('apierror.flow.invalid', 'clearpay', null)));
            } else {
                var order = COHelpers.createOrder(currentBasket);
                paymentStatusUpdated = require('*/cartridge/scripts/checkout/updatePaymentStatus').handlePaymentStatus(order);
                if (paymentStatusUpdated.authorized) {
                    Transaction.begin();
                    orderPlacementStatus = OrderMgr.placeOrder(order);
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
            }
            break;
        case 'CANCELLED':
            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', Resource.msg('clearpay.api.cancelled', 'clearpay', null)));
            break;
        default:
            res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'clearpayErrorMessage', Resource.msg('apierror.flow.default', 'clearpay', null)));
    }
    next();
});

module.exports = server.exports();
