'use strict';
var paymentService = require('*/cartridge/scripts/payment/paymentService');
var clearpayDirectCaptureService = require('*/cartridge/scripts/logic/services/clearpayDirectCapturePaymentService');
var clearpayAuthoriseService = require('*/cartridge/scripts/logic/services/clearpayAuthorisePaymentService');
var PAYMENT_MODE = require('*/cartridge/scripts/util/clearpayConstants').PAYMENT_MODE;
var PAYMENT_STATUS = require('*/cartridge/scripts/util/clearpayConstants').PAYMENT_STATUS;
var { checkoutUtilities: cpCheckoutUtilities, sitePreferencesUtilities : cpSitePreferencesUtilities } = require('*/cartridge/scripts/util/clearpayUtilities');

var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');

/**
 *  processes all the transaction details related to the payment and order
 */
var UpdateOrderService = {
    handleOrder: function (order, paymentStatus, expressCheckoutModel,isCashAppPay) {
        var isCashAppPay = isCashAppPay || false
        var authoriseDirectCaptureResult = null;
        if (paymentStatus === PAYMENT_STATUS.DECLINED) {
            authoriseDirectCaptureResult = this.updateDeclinedOrder(order);
        } else if (paymentStatus === PAYMENT_STATUS.FAILED) {
            authoriseDirectCaptureResult = this.updateFailedOrder(order);
        } else if (paymentStatus === PAYMENT_STATUS.APPROVED) {
            authoriseDirectCaptureResult = this.handleApprovalOrder(order, expressCheckoutModel, isCashAppPay);
        } else if (paymentStatus === PAYMENT_STATUS.PENDING) {
            authoriseDirectCaptureResult = this.handlePendingOrder(order);
        }
        return authoriseDirectCaptureResult;
    },

    handleApprovalOrder: function (order, expressCheckoutModel,isCashAppPay) {
        var paymentAmount = this.getPaymentAmount(order,isCashAppPay);
		// express checkout needs payment amount, even for direct capture.
		// express checkout with deferred flows needs checksum and amount
		// these are all in expressCheckoutModel
        var authoriseDirectCaptureResult = null;
        var authoriseDirectCaptureService = this.getAuthoriseDirectCaptureService(order);
        var requestValues = authoriseDirectCaptureService.generateRequest(order, this.getToken(order,isCashAppPay), order.orderNo, paymentAmount, expressCheckoutModel);

        try {
            authoriseDirectCaptureResult = authoriseDirectCaptureService.getResponse(requestValues.requestUrl, requestValues.requestBody);
        } catch (e) {
            if (e.httpStatusCode === 402) {
                authoriseDirectCaptureResult = { status: PAYMENT_STATUS.DECLINED };
            } else {
                throw e;
            }
        }
        this.updateStatusOrder(order, authoriseDirectCaptureResult);
        return authoriseDirectCaptureResult;
    },

    getAuthoriseDirectCaptureService: function (order) {
        var paymentMode = cpCheckoutUtilities.getPaymentMode();
        if (paymentMode === PAYMENT_MODE.AUTHORISE) {
            return clearpayAuthoriseService;
        }
        return clearpayDirectCaptureService;
    },

    loadPaymentResult: function (order) {
        var paymentID = this.getPaymentID(order);
        var paymentResult = null;
        if (paymentID) {
            var requestUrl = paymentService.generateRequest(null, paymentID);
            paymentResult = paymentService.getResponse(requestUrl);
        }
        return paymentResult;
    },

    getPaymentID: function (order) {
        var cpPaymentID;
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName();

        if (!paymentMethodName) {
            return null;
        }

        for (var i = 0; i < order.paymentInstruments.length; i += 1) {
            var paymentInstrument = order.paymentInstruments[i];

            if (paymentInstrument.paymentMethod.equals(paymentMethodName)) {
                var paymentTransaction = paymentInstrument.paymentTransaction;
                cpPaymentID = paymentTransaction.custom.cpPaymentID;
                break;
            }
        }
        return cpPaymentID;
    },

    getToken: function (order,isCashAppPay) {
        var cpToken;
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName(isCashAppPay);

        if (!paymentMethodName) {
            return null;
        }

        for (var i = 0; i < order.paymentInstruments.length; i += 1) {
            var paymentInstrument = order.paymentInstruments[i];

            if (paymentInstrument.paymentMethod.equals(paymentMethodName)) {
                var paymentTransaction = paymentInstrument.paymentTransaction;
                cpToken = paymentTransaction.custom.cpToken;
                break;
            }
        }
        return cpToken;
    },
    // Need amount for express checkouts
    getPaymentAmount: function (order,isCashAppPay) {
        var paymentMethodName = cpCheckoutUtilities.getPaymentMethodName(isCashAppPay);
        return order.getPaymentInstruments(paymentMethodName)[0].getPaymentTransaction().amount;
    },
    updateOrder: function (order, status) {
        Transaction.begin();
        if (status === Order.ORDER_STATUS_FAILED) {
            OrderMgr.failOrder(order);
        } else if (status === Order.ORDER_STATUS_CANCELLED) {
            OrderMgr.cancelOrder(order);
        } else {
            order.setStatus(status);
        }
        Transaction.commit();
    },

    updateDeclinedOrder: function (order) {
        this.updateOrder(order, Order.ORDER_STATUS_CANCELLED);
    },

    updateFailedOrder: function (order) {
        this.updateOrder(order, Order.ORDER_STATUS_FAILED);
    },

    updateApprovedOrder: function (order, containerView) {
        var  containerView = containerView || 'basket'
        Transaction.begin();
        order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
        Transaction.commit();
        this.sendConfirmationEmail(order, containerView);
    },

    updateStatusOrder: function (order, authoriseDirectCaptureResult) {
        if (authoriseDirectCaptureResult) {
            if (authoriseDirectCaptureResult.status === PAYMENT_STATUS.DECLINED) {
                this.updateDeclinedOrder(order);
            } else if (authoriseDirectCaptureResult.status === PAYMENT_STATUS.FAILED) {
                this.updateFailedOrder(order);
            } else if (authoriseDirectCaptureResult.status === PAYMENT_STATUS.APPROVED) {
                this.updateApprovedOrder(order);
            } else if (authoriseDirectCaptureResult.status === PAYMENT_STATUS.PENDING) {
                this.updatePendingOrder(order);
            }
        }
    },

    sendConfirmationEmail: function (order, containerView) {
        var OrderModel = require('*/cartridge/models/order');
        var emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');

        var orderModel = new OrderModel(order, {
            containerView: containerView || 'basket',
            countryCode: brandUtilities.getCountryCode()
        });

        var orderObject = { order: orderModel };

        var emailObj = {
            to: order.customerEmail,
            subject: Resource.msg('subject.order.confirmation.email', 'order', null),
            from: Site.current.getCustomPreferenceValue('customerServiceEmail') || 'no-reply@salesforce.com',
            type: emailHelpers.emailTypes.orderConfirmation
        };

        emailHelpers.sendEmail(emailObj, 'checkout/confirmation/confirmationEmail', orderObject);
    }
};

module.exports = UpdateOrderService;
