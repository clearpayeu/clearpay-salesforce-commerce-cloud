function initAfterpay(settings) {
    settings = settings || {};
    let commenceDelay = settings.commenceDelay || 0;

    let pickupflag = settings.pickupflag || false;

    let target = settings.target || '#clearpay-express-button';

    let productIdSelector = settings.productIdSelector || null;
    let productQuantitySelector = settings.productQuantitySelector || null;
    AfterPay.initializeForPopup({
        countryCode: $('#clearpay-express-countrycode').val(),
        pickup: pickupflag,
        buyNow: $('#clearpay-express-buynow').val() === 'true',
        shippingOptionRequired: $('#clearpay-express-shipping-option-required').val() === 'true',
        onCommenceCheckout: function (actions) {
            var clearpayExpressTokenUrl = $('#clearpay-express-url-createtoken').val() + '?s_url=' + encodeURIComponent(window.location.href);
            // This is to support Clearpay Express from product details page. Add product to cart and checkout.
            if (productIdSelector && productQuantitySelector) {
                let p_elem = document.querySelector(productIdSelector);
                let q_elem = document.querySelector(productQuantitySelector);
                clearpayExpressTokenUrl += '&cartAction=add&pid=' + (p_elem.value || '') + '&Quantity=' + (q_elem.value || '');
            }

            var currentLocation = window.location.href;
            sleep(commenceDelay).then(() => {
                $.ajax({
                    type: 'GET',
                    url: clearpayExpressTokenUrl,
                    success: function (res) {
                        if (res.status == 'SUCCESS') {
                            var clearpaytoken = res.token.cpToken;
                            actions.resolve(clearpaytoken);
                        } else {
                            clearpayCreateTokenErrorMessage = res.error;
                            alert(res.error);
                            console.log('Clearpay Express Checkout: Token Creation Failure: ', res.error);
                            actions.reject(AfterPay.CONSTANTS.SERVICE_UNAVAILABLE);
                        }
                    },
                    error: function () {
                        console.log('Clearpay Express Checkout: request failure.');
                    }
                });
            });
        },
        // NOTE: onShippingAddressChange only needed if shippingOptionRequired is true
        onShippingAddressChange: function (data, actions) {

            var shippingMetthodsUrl = $('#clearpay-express-url-getshippingmethods').val();
            $.ajax({
                type: 'POST',
                url: shippingMetthodsUrl,
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({
                    countryCode: data.countryCode,
                    postcode: data.postcode,
                    state: data.state,
                    suburb: data.suburb,
                    address1: data.address1,
                    address2: data.address2,
                    area2: data.area2,
                    name: data.name,
                    phoneNumber: data.phoneNumber
                }),
                success: function (response) {
                    if (response.length == 0) {
                        actions.reject(AfterPay.CONSTANTS.SHIPPING_ADDRESS_UNSUPPORTED);
                    } else {
                        actions.resolve(response);
                    }
                },
                error: function () {
                    console.log('Clearpay Express Checkout: failure in get shipping methods');
                }
            });
        },
        onComplete: function (event) {
            if (event.data.status == 'SUCCESS') {
                var clearpayExpressProcessUrl = $('#clearpay-express-url-processorder').val() + '?orderToken=' + event.data.orderToken + '&merchantReference=' + event.data.merchantReference;
                $(location).attr('href', clearpayExpressProcessUrl);
            } else {
                var errorUrl = $('#clearpay-express-url-cancelorder').val() + '?orderToken=' + event.data.orderToken + '&merchantReference=' + event.data.merchantReference;
                $(location).attr('href', errorUrl);
            }
        },
        target: target || '#clearpay-express-button'
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Reinitialize the Clearpay popup by first doing an ajax
// call to the server to determine eligibility for Clearpay Express
// and calling initAfterpay with the setting
function reinitializeAfterpayPopup() {
    let getCartStatusUrl = $('#clearpay-express-url-cartstatus').val();
    $.ajax({
        type: 'GET',
        url: getCartStatusUrl,
        success: function (res) {
            var instorepickup = res.instorepickup;
            initAfterpay({ pickupflag: instorepickup });
        },
        error: function () {
            console.log('Afterpay Express cart status request failure.');
        }
    });
}

/**
 * Listens for changes in the home delivery vs in-store pickup radio button toggle.
 * Once any toggle happens, we want to wait for the "loading" widget to disappear
 * and then call reinitializeAfterpayPopup().
 *
 * The "loading" is controlled by the existence of the "loading" class on
 * .item-delivery-options, so wait for that to disappear.
 */
function initializeDeliveryOptionChangeListener() {
    let elements = document.querySelectorAll('.delivery-option');
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('change', function () {
            if ('MutationObserver' in window) {
                let loadingElement = document.querySelector('.item-delivery-options');
                let observer = new MutationObserver(function (entries) {
                    if (!document.querySelector('.item-delivery-options.loading')) {
                        reinitializeAfterpayPopup();
                        observer.disconnect();
                    }
                });
                observer.observe(loadingElement, { attributeFilter: ['class'] });
            } else {
                // If no MutationObserver support, just use timer to poll state
                var checkLoading = setInterval(function () {
                    if (!document.querySelector('.item-delivery-options.loading')) {
                        reinitializeAfterpayPopup();
                        clearInterval(checkLoading);
                    }
                }, 500);
            }
        });
    }
}
