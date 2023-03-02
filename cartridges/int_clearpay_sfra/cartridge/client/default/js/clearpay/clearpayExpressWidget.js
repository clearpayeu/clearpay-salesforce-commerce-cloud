'use strict';

/**
 * Updates the clearpay express checkout widget with the total value
 * which should be located in the element '.grand-total-sum'
 * This also updates the checkout widget for non-express-checkout orders
 */
function updateExpressWidget() {
    var currency = $('#clearpay-widget-currency').val();
    var grandTotalSum = $('.grand-total-sum').text();
    if (currency === 'EUR') {
        $('.clearpay-widget').removeClass('clearpay-hide');
        if ($('afterpay-placement').length != 0) {
            $('afterpay-placement').attr('data-amount', grandTotalSum);
        }
        grandTotalSum = '0.00';
    } else if ($('.clearpay-widget').hasClass('afterpay-placement') && $('.afterpay-placement').hasAttribute('data-amount')) {
        grandTotalSum = $('.afterpay-placement').attr('data-amount');
    } else {
        // eslint-disable-next-line no-useless-escape
        grandTotalSum = Number(grandTotalSum.replace(/[^0-9\.-]+/g, '')).toString();
    }

    if ('clearpayWidget' in window) {
        clearpayWidget.update({
            amount: { amount: grandTotalSum, currency: currency }
        });
    }
    $('#clearpay-widget-amount').val(grandTotalSum);
    $('#clearpay-widget-currency').val(currency);
}

module.exports.updateExpressWidget = updateExpressWidget;
