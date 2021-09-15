$(document).ajaxComplete(function () {
    if ($('.minicart #clearpay-express-button').length > 0) {
        let cnt = 0;
        let sid = setInterval(function () {
            if (typeof initAfterpay === 'function' && typeof AfterPay !== 'undefined') {
                clearInterval(sid);
                initAfterpay({ pickupflag: $('#clearpay-express-storepickup').val() === 'true' });
            }
            if (cnt === 10) {
                clearInterval(sid);
            }
            ++cnt;
        }, 500);
    }
});
