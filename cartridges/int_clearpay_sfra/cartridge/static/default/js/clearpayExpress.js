function initAfterpay(settings) {
    settings = settings || {};
    let commenceDelay = settings.commenceDelay || 0;

    let pickupflag = settings.pickupflag || false;

    let target = settings.target || '#clearpay-express-button';

    let productIdSelector = settings.productIdSelector || null;
    let productQuantitySelector = settings.productQuantitySelector || null;
    let clearpayCreateTokenErrorMessage = '';
    AfterPay.initializeForPopup({
        countryCode: $('#clearpay-express-countrycode').val(),
        pickup: pickupflag,
        buyNow: $('#clearpay-express-buynow').val() === 'true',
        shippingOptionRequired: $('#clearpay-express-shipping-option-required').val() === 'true',
        onCommenceCheckout: function (actions) {
            console.log('onCommenceCheckout(). Actions=', actions);
            var clearpayExpressTokenUrl = $('#clearpay-express-url-createtoken').val() + '?s_url=' + encodeURIComponent(window.location.href);
            // This is to support Clearpay Express from product details page. Add product to cart and checkout.
            if (productIdSelector && productQuantitySelector) {
                let p_elem = document.querySelector(productIdSelector);
                let q_elem = document.querySelector(productQuantitySelector);
                clearpayExpressTokenUrl += '&cartAction=add&pid=' + (p_elem.innerText || '') + '&Quantity=' + (q_elem.value || '');
            }

            // var clearpayExpressTokenUrl = $('#clearpay-express-url-createtoken').val() + "?s_url=" + encodeURIComponent(window.location.href + "&format=ajax&Quantity=1&cartAction=add&pid=640188017003");
            console.log('onCommenceCheckout(). TokenUrl: ', clearpayExpressTokenUrl);
            var currentLocation = window.location.href;
            sleep(commenceDelay).then(() => {
                $.ajax({
                    type: 'GET',
                    url: clearpayExpressTokenUrl,
                    success: function (res) {
                        if (res.status == 'SUCCESS') {
                            console.log('Result of CreateToken: ', res);
                            // var clearpaytoken = res.response.clearpaytoken;
                            var clearpaytoken = res.token.cpToken;
                            console.log('Got token from clearpay: ', clearpaytoken);
                            actions.resolve(clearpaytoken);
                        } else {
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
            console.log('onShippingAddressChange called. data=', data);
            var shippingMetthodsUrl = $('#clearpay-express-url-getshippingmethods').val();
            console.log('Calling this to get shipping methods: ' + shippingMetthodsUrl);
            $.ajax({
                type: 'POST',
                url: shippingMetthodsUrl,
                data: {
                    countryCode: data.countryCode,
                    postcode: data.postcode,
                    state: data.state,
                    suburb: data.suburb,
                    address1: data.address1,
                    address2: data.address2,
                    area2: data.area2,
                    name: data.name,
                    phoneNumber: data.phoneNumber
                },
                success: function (response) {
                    console.log('shipping method computed successfully. Returning data to Clearpay portal via resolve. shippingMethods=', response);
                        // Need to handle case where address is unsupported/invalid
                    if (!response.shipmethods || response.shipmethods.length == 0) {
                        actions.reject(AfterPay.CONSTANTS.SHIPPING_ADDRESS_UNSUPPORTED);
                    } else {
                        actions.resolve(response.shipmethods);
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
function reinitializeClearpayPopup() {
    let getCartStatusUrl = $('#clearpay-express-url-cartstatus').val();
    $.ajax({
        type: 'GET',
        url: getCartStatusUrl,
        success: function (res) {
            var instorepickup = res.instorepickup;
            initAfterpay(instorepickup);
        },
        error: function () {
            console.log('Clearpay Express cart status request failure.');
        }
    });
}

/**
 * Listens for changes in the home delivery vs in-store pickup radio button toggle.
 * Once any toggle happens, we want to wait for the "loading" widget to disappear
 * and then call reinitializeClearpayPopup().
 *
 * The "loading" is controlled by the existence of the "loading" class on
 * .item-delivery-options, so wait for that to disappear.
 */
function initializeDeliveryOptionChangeListener() {
    let elements = document.querySelectorAll('.delivery-option');
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('change', function () {
            let loadingElement = document.querySelector('.item-delivery-options');
            let observer = new MutationObserver(function (entries) {
                if (!document.querySelector('.item-delivery-options.loading')) {
                    reinitializeClearpayPopup();
                    observer.disconnect();
                }
            });
            observer.observe(loadingElement, { attributeFilter: ['class'] });
        });
    }
}
