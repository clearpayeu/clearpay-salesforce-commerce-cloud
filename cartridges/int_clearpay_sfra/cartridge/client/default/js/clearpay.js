'use strict';
/* global $ */
var processInclude = require('base/util');
/**
 * Gets Widget HTML from AfterPay API
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
            } else if (typeof $productContainer !== 'undefined') {
                $productContainer.find('.clearpay-widget').html('');
                $productContainer.find('.clearpay-widget').show();
            } else if (typeof $productContainer === 'undefined') {
                $('.clearpay-widget').html('');
                $('.clearpay-widget').show();
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

/**
 * @description Update Pickup Store
 */
function updateStorePickupState() {
    var getCartStatusUrl = $('#clearpay-express-url-cartstatus').val();
    if (getCartStatusUrl) {
        $.ajax({
            url: getCartStatusUrl,
            method: 'GET',
            success: function (data) {
                if (data.instorepickup) {
                    console.log('In store pickup: ', data.instorepickup);
                    $('#clearpay-express-storepickup').val(data.instorepickup.toString());
                    initAfterpay({ pickupflag: data.instorepickup });
                }
            }
        });
    }
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

        if (!$('#clearpay-express-url-cartstatus').hasClass('loading')) {
            $('#clearpay-express-url-cartstatus').addClass('loading');
        }
    });

    $('#clearpay-continue-finalize-button').on('click', function (e) {
        window.location.href = $('#clearpayurl-continuefinalize').val();
    });


    if (typeof initAfterpay === 'function') {
        if ($('#clearpay-express-pdp-button').length > 0) {
            initAfterpay({pickupflag: "false", commenceDelay: 200, target: '#clearpay-express-pdp-button'});
        }

        if ($('#clearpay-express-button').length > 0) {
            initAfterpay({pickupflag: $('#clearpay-express-storepickup').val() === "true"});
        }
    }

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

        // make sure we call initAfterpay after the minicart loads so checkout click will work
        if ($('.minicart #clearpay-express-button').length > 0) {
            let cnt = 0;
            let sid = setInterval(function () {
                if (typeof initAfterpay === 'function' && typeof AfterPay !== 'undefined') {
                    clearInterval(sid);
                    initAfterpay({ pickupflag: $('#clearpay-express-storepickup').val() === 'true' });
                }
                if (cnt === 10) {
                    clearInterval(sid);
                }
                ++cnt;
            }, 500);
        }

        // On pdp page, if a store is selected, disable buy now express checkout button.
        if ($('.store-name').length > 0) {
            $('#clearpay-express-pdp-button').addClass('clearpay-hide');
        } else {
            $('#clearpay-express-pdp-button').removeClass('clearpay-hide');
        }


        if ($('.cart-page').length > 0) {
            // Just put a loading class on the url input so this does not get called recursively
            if ($('#clearpay-express-url-cartstatus').hasClass('loading')) {
                updateStorePickupState();
                $('#clearpay-express-url-cartstatus').removeClass('loading');
            }
        }
    });

    // initialize
});