'use strict';

var processInclude = require('base/util');
/**
 * Gets Widget HTML from ClearPay API
 * @param {string} updatedProductID - product ID
 * @param {number} updatedPrice - product price
 * @param {string} className - HTML class name
 * @param {jquery} $productContainer - DOM container for product
 */
function getWidget(updatedProductID, updatedPrice, className, $productContainer) {
    var getUpdatedWidgetUrl = $('.updated-widget').val();
    var queryString = '?productID=' + updatedProductID + '&updatedPrice=' + updatedPrice + '&className=' + className;
    $.ajax({
        url: getUpdatedWidgetUrl + queryString,
        method: 'GET',
        success: function (data) {
            if (data.updatedWidget) {
                if (typeof $productContainer !== 'undefined') {
                    $productContainer.find('.clearpay-widget').html(data.updatedWidget);
                    $productContainer.find('.clearpay-widget').show();
                } else if (typeof $productContainer === 'undefined') {
                    $('.clearpay-widget').html(data.updatedWidget);
                    $('.clearpay-widget').show();
                }
            }
            $('#clearpay-express-pdp-button').toggleClass('clearpay-hide', !data.cpApplicable);
        }
    });
}

/**
 * @description Update widget for PDP specifically
 */
function updatePdpWidget() {
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
                    $('#clearpay-express-storepickup').val(data.instorepickup.toString());
                    initClearpay({ pickupflag: data.instorepickup });
                }

                $('#clearpay-express-button').toggleClass('clearpay-hide', !data.cpApplicable);
            }
        });
    }
}

$(document).ready(function () {
    processInclude(require('./clearpay/clearpayContent'));

    var cartTotal = '';

    $('body').on('product:afterAttributeSelect', function () {
        updatePdpWidget();
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

    $('#clearpay-continue-finalize-button').on('click', function () {
        window.location.href = $('#clearpayurl-continuefinalize').val();
    });

    if (typeof initClearpay === 'function') {
        if ($('#clearpay-express-pdp-button').length > 0) {
            initClearpay({ pickupflag: 'false', commenceDelay: 200, target: '#clearpay-express-pdp-button' });
        }

        if ($('#clearpay-express-button').length > 0) {
            initClearpay({ pickupflag: $('#clearpay-express-storepickup').val() === 'true' });
        }
    }

    $(document).ajaxComplete(function () {
        var newCartTotal = $('.grand-total').text();

        if ($('.clearpay-widget').hasClass('loading')) {
            $('.clearpay-widget').removeClass('loading');

            if ($('.clearpay-widget').length && cartTotal !== newCartTotal) {
                getWidget(null, null, 'cart-clearpay-message');
            }
        }

        // make sure we call initClearpay after the minicart loads so checkout click will work
        if ($('.minicart #clearpay-express-button').length > 0) {
            var cnt = 0;
            var sid = setInterval(function () {
                if (typeof initClearpay === 'function' && typeof AfterPay !== 'undefined') {
                    clearInterval(sid);
                    initClearpay({ pickupflag: $('#clearpay-express-storepickup').val() === 'true' });
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
        }

        if ($('.cart-page').length > 0) {
            // Just put a loading class on the url input so this does not get called recursively
            if ($('#clearpay-express-url-cartstatus').hasClass('loading')) {
                updateStorePickupState();
                $('#clearpay-express-url-cartstatus').removeClass('loading');
            }
        }

        if ($('div').hasClass('popover popover-bottom show')) {
            if ($('#clearpay-express-url-cartstatus').hasClass('loading')) {
                updateStorePickupState();
                $('#clearpay-express-url-cartstatus').removeClass('loading');
            }
        }
    });

    // initialize
});
