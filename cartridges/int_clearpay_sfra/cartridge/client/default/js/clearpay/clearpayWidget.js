'use strict';
/* global $ */

/**
 * Gets Widget HTML from ClearPay API
 * @param {string} updatedProductID - product ID
 * @param {number} updatedProductPrice - product price
 * @param {string} className - HTML class name
 * @param {jquery} $productContainer - DOM container for product
 */
function getWidget(updatedProductID, updatedProductPrice, className, $productContainer) {
    var getUpdatedWidgetUrl = $('.updated-widget').val();
    var queryString = '?productID=' + updatedProductID + '&updatedProductPrice=' + updatedProductPrice + '&className=' + className;
    $.ajax({
        url: getUpdatedWidgetUrl + queryString,
        method: 'GET',
        success: function (data) {
            if (data.cpApplicable && data.updatedWidget) {
                if (typeof $productContainer !== 'undefined') {
                    $productContainer.find('.clearpay-widget').html(data.updatedWidget);
                    $productContainer.find('.clearpay-widget').show();
                } else if (typeof $productContainer === 'undefined') {
                    $('.clearpay-widget').html(data.updatedWidget);
                    $('.clearpay-widget').show();
                }
            } else {
                if (typeof $productContainer !== 'undefined') {
                    $productContainer.find('.clearpay-widget').empty().show();
                } else if (typeof $productContainer === 'undefined') {
                    $('.clearpay-widget').empty().show();
                }
            }
        }
    });
}

module.exports.getWidget = getWidget;
