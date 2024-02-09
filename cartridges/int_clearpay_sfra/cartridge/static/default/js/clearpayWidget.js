/**
 * Creates checkout widget for Clearpay
 */
function createClearpayWidget() {
    if ($('#clearpay-widget-amount').length != 0) {
        window.clearpayWidget = new AfterPay.Widgets.PaymentSchedule({
            token: $('#clearpay-token').val(),
            amount: { amount: $('#clearpay-widget-amount').val(), currency: $('#clearpay-widget-currency').val() },
            target: '#clearpay-widget-container',
            locale: $('#clearpay-widget-locale').val().replace('_', '-'),
            onReady: function () {
                $('.clearpay-widget-hideuntilready').css('visibility', 'visible');
            // Fires when the widget is ready to accept updates.
            },
            onChange: function (event) {
                if (!event.data.isValid) {
                    // var widgetErrorUrl = $('#clearpay-express-url-widgeterror').val() + '?error=' + encodeURIComponent(event.data.error);
                    // window.location.assign(widgetErrorUrl);
                    // Need to clear the session
                }
            // Fires after each update and on any other state changes.
            // See 'Getting the widget's state' for more details.
            },
            onError: function () {
                var errorUrl = $('#clearpay-express-url-cancelorder').val();
                $(location).attr('href', errorUrl);
            // See 'Handling widget errors' for more details.
            }
        });
    }
}
