/**
 * Resource helper
 *
 */
function ResourceHelper() {}

/**
 * Get the client-side resources of a given page
 * @returns {Object} An objects key key-value pairs holding the resources
 */
ResourceHelper.getResources = function () {
    var Resource = require('dw/web/Resource');

    // application resources
    var resources = {
        // Transaction operation messages
        SHOW_ACTIONS: Resource.msg('operations.show.actions', 'clearpay', null),
        HIDE_ACTIONS: Resource.msg('operations.hide.actions', 'clearpay', null),
        CHOOSE_ACTIONS: Resource.msg('operations.actions', 'clearpay', null),
        CHOOSE_ORDERS: Resource.msg('operations.orders', 'clearpay', null),
        TRANSACTION_SUCCESS: Resource.msg('transaction.success', 'clearpay', null),
        TRANSACTION_FAILED: Resource.msg('transaction.failed', 'clearpay', null),
        BULK_AUTHORIZE_FAILED: Resource.msg('bulk.authorize.failed', 'clearpay', null),
        TRANSACTION_PROCESSING: Resource.msg('operations.wait', 'clearpay', null),
        INVALID_COMPLETE_AMOUNT: Resource.msg('complete.amount.validation', 'clearpay', null),
        INVALID_REFUND_AMOUNT: Resource.msg('refund.amount.validation', 'clearpay', null),
        MAXIMUM_REFUND_AMOUNT: Resource.msg('maximum.refund.amount', 'clearpay', null),
        MAXIMUM_COMPLETE_AMOUNT: Resource.msg('maximum.complete.amount', 'clearpay', null)
    };
    return resources;
};

/**
 * Get the client-side URLs of a given page
 * @returns {Object} An objects key key-value pairs holding the URLs
 */
ResourceHelper.getUrls = function () {
    var URLUtils = require('dw/web/URLUtils');

    // application urls
    var urls = {
        operationActions: URLUtils.url('Operations-Action').toString()
    };

    return urls;
};

module.exports = ResourceHelper;
