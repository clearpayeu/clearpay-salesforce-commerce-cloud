'use strict';

var clearpayRedirect = require('../clearpay/clearpayRedirect');
var clearpayWidget = require('../clearpay/clearpayWidget');

var exports = {
    initialize: function () {
        $(document).ready(function () {
            clearpayRedirect.selectPaymentMethod();

            $(document).ajaxComplete(function () {
                clearpayRedirect.selectPaymentMethod();
            });

            $('button.submit-payment').on('click', function (e) {
                var isClearpayTab = $('.clearpay-tab').hasClass('active') || $('.clearpay-tab').hasClass('active');

                if (isClearpayTab) {
                    e.stopPropagation();
                    clearpayRedirect.generalValidation();
                }
            });
        });
    },
    updateCheckoutView: function () {
        $('body').on('checkout:updateCheckoutView', function () {
            // Refresh checkout Clearpay Widget
            clearpayWidget.getWidget(null, null, 'checkout-clearpay-message');
        });
    }
};

module.exports = exports;
