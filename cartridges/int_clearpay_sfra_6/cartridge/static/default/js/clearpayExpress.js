function initClearpay(settings) {
    settings = settings || {};
    var commenceDelay = settings.commenceDelay || 0;

    var pickupflag = settings.pickupflag || false;

    var target = settings.target || '#clearpay-express-button';

    var productIdSelector = settings.productIdSelector || null;
    var productQuantitySelector = settings.productQuantitySelector || null;
    var clearpayCreateTokenErrorMessage = '';
    AfterPay.initializeForPopup({
        countryCode: $('#clearpay-express-countrycode').val(),
        pickup: pickupflag,
        buyNow: $('#clearpay-express-buynow').val() === 'true',
        shippingOptionRequired: $('#clearpay-express-shipping-option-required').val() === 'true',
        onCommenceCheckout: function (actions) {
            var getShippingOptionUrl = $('#clearpay-express-url-shippingrequired').val();
            if (getShippingOptionUrl) {
                $.ajax({
                    url: getShippingOptionUrl,
                    method: 'GET',
                    success: function (data) {
                        if (data.shipmentType) {
                            if (data.shipmentType == 'SplitShipment' || data.shipmentType == 'MultiplePickup') {
                                AfterPay.shippingOptionRequired = false;
                            }
                        }

                        var clearpayExpressTokenUrl = $('#clearpay-express-url-createtoken').val() + '?s_url=' + encodeURIComponent(window.location.href);
                        // This is to support Clearpay Express from product details page. Add product to cart and checkout.
                        if (productIdSelector && productQuantitySelector) {
                            var p_elem = document.querySelector(productIdSelector);
                            var q_elem = document.querySelector(productQuantitySelector);
                            clearpayExpressTokenUrl += '&cartAction=add&pid=' + (p_elem.innerText || '') + '&Quantity=' + (q_elem.value || '');
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
                                        alert(res.error);
                                        actions.reject(AfterPay.CONSTANTS.SERVICE_UNAVAILABLE);
                                    }
                                },
                                error: function () {
                                    alert('Clearpay payment failed.');
                                }
                            });
                        });
                        
                    },
                    error: function () {
                        alert('Clearpay payment failed.');
                    }
                });
            }
        },
        // NOTE: onShippingAddressChange only needed if shippingOptionRequired is true
        onShippingAddressChange: function (data, actions) {
            var shippingMetthodsUrl = $('#clearpay-express-url-getshippingmethods').val();
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
                        // Need to handle case where address is unsupported/invalid
                    if (!response.shipmethods || response.shipmethods.length == 0) {
                        actions.reject(AfterPay.CONSTANTS.SHIPPING_ADDRESS_UNSUPPORTED);
                    } else {
                        actions.resolve(response.shipmethods);
                    }
                },
                error: function () {
                    alert('Clearpay payment failed.');
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
// and calling initClearpay with the setting
function reinitializeClearpayPopup() {
    var getCartStatusUrl = $('#clearpay-express-url-cartstatus').val();
    $.ajax({
        type: 'GET',
        url: getCartStatusUrl,
        success: function (res) {
            var instorepickup = res.instorepickup;
            initClearpay(instorepickup);
        },
        error: function () {
            alert('Clearpay payment failed.');
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
    var elements = document.querySelectorAll('.delivery-option');
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('change', function () {
            var loadingElement = document.querySelector('.item-delivery-options');
            var observer = new MutationObserver(function (entries) {
                if (!document.querySelector('.item-delivery-options.loading')) {
                    reinitializeClearpayPopup();
                    observer.disconnect();
                }
            });
            observer.observe(loadingElement, { attributeFilter: ['class'] });
        });
    }
}

