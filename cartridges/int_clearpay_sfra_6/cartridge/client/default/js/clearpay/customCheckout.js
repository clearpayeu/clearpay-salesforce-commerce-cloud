'use strict';

var clearpayRedirect = require('../clearpay/clearpayRedirect');
var clearpayExpressWidget = require('../clearpay/clearpayExpressWidget');

/**
 * Hide all states
 */
function hideAllStates() {
    $('.ap-checkout-ship').addClass('clearpay-hide');

    $('.ap-checkout-pay-tab-ecf').addClass('clearpay-hide');
    $('.ap-checkout-pay-tab-noecf').addClass('clearpay-hide');
    $('.ap-checkout-pay-notab-ecf').addClass('clearpay-hide');
    $('.ap-checkout-pay-notab-noecf').addClass('clearpay-hide');

    // An clearpay payment instrument at placeorder screen should always be
    // express checkout since the non-express-checkout skips the placeorder screen
    // entirely.
    $('.ap-checkout-po-ecf').addClass('clearpay-hide');
    $('.ap-checkout-po-noecf').addClass('clearpay-hide');
}

/**
 * Handle changes between different checkout stages
 */
function handleStateChange() {
    var cmElem = document.querySelector('#checkout-main');
    var stage = cmElem.getAttribute('data-checkout-stage');

    var ecFinalize = false;
    if ($('#clearpay-express-checkout-finalize').length > 0 && $('#clearpay-express-checkout-finalize').val() === 'true') {
        ecFinalize = true;
    }

    // Always do removeClass after addClass in case same element has multiple classes
    if (stage === 'customer') {
        hideAllStates();
    } else if (stage === 'shipping') {
        hideAllStates();
        $('.ap-checkout-ship').removeClass('clearpay-hide');
    } else if (stage === 'payment') {
        var isClearpayTab = $('.clearpay-tab').hasClass('active');
        hideAllStates();
        if (isClearpayTab) {
            if (ecFinalize) {
                $('.ap-checkout-pay-tab-ecf').removeClass('clearpay-hide');
            } else {
                $('.ap-checkout-pay-tab-noecf').removeClass('clearpay-hide');
            }
        } else if (ecFinalize) {
            $('.ap-checkout-pay-notab-ecf').removeClass('clearpay-hide');
        } else {
            $('.ap-checkout-pay-notab-noecf').removeClass('clearpay-hide');
        }
        $(document).ajaxComplete(function () {
            if (ecFinalize) {
                if (typeof createClearpayWidget === 'function' && typeof AfterPay != 'undefined' && !('clearpayWidget' in window)) {
                    createClearpayWidget();
                }
            }
        });
    } else if (stage === 'placeOrder') {
        var isClearpayPayment = $('#clearpay-payment-shown').length;

        hideAllStates();
        if (typeof createClearpayWidget === 'function' && typeof AfterPay != 'undefined' && !('clearpayWidget' in window)) {
            createClearpayWidget();
        }
        if (isClearpayPayment) {
            $('.ap-checkout-po-ecf').removeClass('clearpay-hide');
        } else {
            // If there's no Clearpay payment on the placeOrder stage, just cancel express checkout finalize flow
            $('#clearpay-express-checkout-finalize').val(false);
            $('.ap-checkout-po-noecf').removeClass('clearpay-hide');
        }
    }
}

var exports = {
    initialize: function () {
        $(document).ready(function () {
            clearpayRedirect.selectPaymentMethod();

            $(document).ajaxComplete(function () {
                clearpayRedirect.selectPaymentMethod();
            });
            // do clearpay redirect method if the original submit button is clicked
            // with clearpay as payment type
            $('button.submit-payment').on('click', function (e) {
                var isClearpayTab = $('.clearpay-tab').hasClass('active');

                if (isClearpayTab) {
                    e.stopPropagation();
                    clearpayRedirect.generalValidation();
                }
            });
            // update the widget with correct amounts on initial page load
            clearpayExpressWidget.updateExpressWidget();

            // Call handleStage when page is loaded/reloaded
            handleStateChange();

            var cmElem = document.querySelector('#checkout-main');
            // Call handleStage with new stage whenever we detect the stage change
            // SFRA base changes attributes on #checkout-main to indicate stage of checkout flow changes
            if (window.MutationObserver) {
                var cmElemObserver = new MutationObserver(function (mutations) {
                    Object.values(mutations).forEach(function (mutation) {
                        if (mutation.type === 'attributes') {
                            handleStateChange();
                        }
                    });
                });
                cmElemObserver.observe(cmElem, { attributes: true });
            } else {
                // If no MutationObserver support, just use interval to poll state
                setInterval(function () {
                    handleStateChange();
                }, 500);
            }

            // Call handleStage with new stage whenever clearpay payment tab is pressed
            var tabelem = document.querySelector('.clearpay-tab');
            if (window.MutationObserver) {
                var tabelemObserver = new MutationObserver(function () {
                    if ($('.clearpay-tab').hasClass('active')) {
                        clearpayExpressWidget.updateExpressWidget();
                    }
                    handleStateChange();
                });
                tabelemObserver.observe(tabelem, { attributes: true });
            }

            // Handle place-order button click
            $('#clearpay-placeorder-button').on('click', function () {
                if (typeof clearpayWidget !== 'undefined') {
                    var url = $('#clearpay-express-url-finalize').val();
                    var checksum = clearpayWidget.paymentScheduleChecksum;
                    window.location.href = url + '?checksum=' + checksum;
                }
            });

            // if express checkout finalization flow, then select the clearpay payment
            // tab by default
            if (($('#clearpay-express-checkout-finalize').val() === 'true') && (parseFloat($('#clearpay-widget-amount').val()) > 0.0)) {
                $('.clearpay-content').addClass('active');
                $('.clearpay-tab').addClass('active');
                $('.credit-card-content').removeClass('active');
                $('.credit-card-tab').removeClass('active');
            }
        });
    },
    updateCheckoutView: function () {
        $('body').on('checkout:updateCheckoutView', function () {
            clearpayExpressWidget.updateExpressWidget();
        });
    }
};

module.exports = exports;
