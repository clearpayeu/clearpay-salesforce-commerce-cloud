'use strict';

/**
 * Updates the clearpay express checkout widget with the total value
 * which should be located in the element '.grand-total-sum'
 * This also updates the checkout widget for non-express-checkout orders
 */
function updateExpressWidget() {
    var currency = $('#clearpay-widget-currency').val();
    var grandTotalSum = $('.grand-total-sum').text();

    // eslint-disable-next-line no-useless-escape
    grandTotalSum = Number(grandTotalSum.replace(/[^0-9\.-]+/g, '')).toString();
    $('#clearpay-widget-amount').val(grandTotalSum);
    $('#clearpay-widget-currency').val(currency);

    if ('clearpayWidget' in window) {
        clearpayWidget.update({
            amount: { amount: grandTotalSum, currency: currency }
        });
    }
}

module.exports.updateExpressWidget = updateExpressWidget;
