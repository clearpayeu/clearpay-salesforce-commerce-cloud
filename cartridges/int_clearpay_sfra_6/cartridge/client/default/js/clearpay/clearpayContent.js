'use strict';
/* global $ */

var clearpay;

/**
 * Populates clearpay popup modal
 * @param {jquery} e - jquery element
 */
function openClearpayModal(e) {
    e.preventDefault();

    var url = $(this).prop('href');

    $.get(url, function (data) {
        if ($('#clearpayModal').length) {
            $('#clearpayModal').remove();
        }
        var htmlString = '<!-- Modal -->' +
            '<div class="modal fade clearpayModal" id="clearpayModal" role="dialog">' +
            '<div class="modal-dialog quick-view-dialog">' +
            '<!-- Modal content-->' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '    <button type="button" class="close-clearpay pull-right" data-dismiss="modal">' +
            '        <span class="close-button">&times;</span>' +
            '    </button>' +
            '</div>' +
            '<div class="modal-body">' + data + '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
        $('body').append(htmlString);
        $('body').addClass('modal-open');
        $('#clearpayModal').addClass('show');

        $('#overview-container-circles img').on('load', function () {
            clearpay.popupVerticalCenter();
        });
    });
}

clearpay = {
    init: function () {
        $('div[itemid="#product"], .product-detail, .cart-page, .tab-content').on('click', '.clearpay-link a', openClearpayModal);

        $('body').on('click', '#clearpayModal .modal-header button', function () {
            $('#clearpayModal').remove();
            $('body').removeClass('modal-open');
        });
    }
};

module.exports = clearpay;
