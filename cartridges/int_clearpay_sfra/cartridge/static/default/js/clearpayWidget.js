function createClearpayWidget () {
    window.clearpayWidget = new AfterPay.Widgets.PaymentSchedule({
        token: $('#clearpay-token').val(),
        amount: { amount: $('#clearpay-widget-amount').val(), currency: $('#clearpay-widget-currency').val() },
        target: '#clearpay-widget-container',
        locale: $('#clearpay-widget-locale').val().replace("_", "-"), 
        onReady: function (event) {
            console.log("onReady() called. event=", event);
            clearpayWidget.update({
                amount: { amount: $('#clearpay-widget-amount').val(), currency: $('#clearpay-widget-currency').val() },
            });
            $('.clearpay-widget-hideuntilready').css("visibility", "visible");
        // Fires when the widget is ready to accept updates.  
        },
        onChange: function (event) {
            console.log("onChange() called. event=", event.data);
            if (!event.data.isValid) {
                let widgetErrorUrl = $('#clearpay-express-url-widgeterror').val() + "?error=" + encodeURIComponent(event.data.error);
                console.log("Error with Clearpay Widget: " + event.data.error);
                window.location.assign(widgetErrorUrl);
                // Need to clear the session
            }
        // Fires after each update and on any other state changes.
        // See "Getting the widget's state" for more details.
        },
        onError: function (event) {
            console.log("onError() called. event=", event);
            var errorUrl = $('#clearpay-express-url-cancelorder').val();
            $(location).attr('href', errorUrl);
        // See "Handling widget errors" for more details.
        },
    })
}

function priceUpdate() {
    clearpayWidget.update({
        amount: { amount: $('#clearpay-widget-amount').val(), currency: $('#clearpay-widget-currency').val() },
    });
}

function checkCartAndUpdateWidget() {
    let getCartStatusUrl = $('#clearpay-express-url-cartstatus').val();
    $.ajax({
        type: 'GET',
        url: getCartStatusUrl,
        success: function(res) {
            clearpayWidget.update({
                amount: { amount: res.cartTotalAmount.toString(), currency: res.cartTotalCurrency },
            });
        },
        error: function(){
            console.log("Clearpay Express cart status request failure.");
        }
    });
}