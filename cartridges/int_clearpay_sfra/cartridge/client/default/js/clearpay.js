'use strict';
/* global $ */
var processInclude = require('base/util');
/**
 * Gets Widget HTML from ClearPay API
 * @param {string} updatedProductID - product ID
 * @param {number} updatedProductPrice - product price
 * @param {string} className - HTML class name
 * @param {jquery} $productContainer - DOM container for product
 */
function getWidget(updatedProductID, updatedProductPrice, className, $productContainer) {
    var getUpdatedWidgetUrl = $('.updated-widget').val();
    var queryString = '?productID=' + updatedProductID + '&updatedProductPrice=' + updatedProductPrice + '&className=' + className;
    $.ajax({
        url: getUpdatedWidgetUrl + queryString,
        method: 'GET',
        success: function (data) {
            if (data.apApplicable && data.updatedWidget) {
                if (typeof $productContainer !== 'undefined') {
                    $productContainer.find('.clearpay-widget').html(data.updatedWidget);
                    $productContainer.find('.clearpay-widget').show();
                } else if (typeof $productContainer === 'undefined') {
                    $('.clearpay-widget').html(data.updatedWidget);
                    $('.clearpay-widget').show();
                }
            } else {
                if (typeof $productContainer !== 'undefined') {
                    $productContainer.find('.clearpay-widget').html('');
                    $productContainer.find('.clearpay-widget').show();
                } else if (typeof $productContainer === 'undefined') {
                    $('.clearpay-widget').html('');
                    $('.clearpay-widget').show();
                }
            }
        }
    });
}

/**
 * @description Update widget for PDP specifically
 */
function updatePpdWidget() {
    var productID = $('.product-id').text();
    var productPrice = $('.prices-add-to-cart-actions .prices .price .sales .value').attr('content');
    var productContainer = $('.product-detail');

    getWidget(productID, productPrice, 'pdp-clearpay-message', productContainer);
}

$(document).ready(function () {
    processInclude(require('./clearpay/clearpayContent'));

    var cartTotal = '';

    $('body').on('product:afterAttributeSelect', function () {
        updatePpdWidget();
    });

    $(document).ajaxStart(function () {
        if (!$('.clearpay-widget').hasClass('loading')) {
            $('.clearpay-widget').addClass('loading');

            if ($('.clearpay-widget .cart-clearpay-message').length) {
                cartTotal = $('.grand-total').text();
            }
        }
    });

    $(document).ajaxComplete(function () {
        var newCartTotal = $('.grand-total').text();

        if ($('.clearpay-widget').hasClass('loading')) {
            $('.clearpay-widget').removeClass('loading');

            if ($('.clearpay-widget').length && cartTotal !== newCartTotal) {
                $('afterpay-placement').attr('data-amount', newCartTotal);
            }

            if ($('.clearpay-widget .pdp-clearpay-message').length) {
                updatePpdWidget();
            }
        }
    });
});
