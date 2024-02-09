'use strict';

/**
 * Updates Checkout Widget HTML
 */
function updateCheckoutWidget() {
    var getUpdatedWidgetUrl = $('.checkout-widget').val();
    $.ajax({
        url: getUpdatedWidgetUrl,
        method: 'GET',
        success: function (data) {
            if (data.updatedWidget) {
                $('.clearpay-checkout-widget').html(data.updatedWidget);
                $('.clearpay-checkout-widget').show();
            }
        },
        error: function () {
            $('.clearpay-checkout-widget').hide();
        }
    });
}

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
    updateCheckoutWidget();
}

module.exports.updateExpressWidget = updateExpressWidget;
