var BaseContext = require('*/cartridge/scripts/context/context');

/**
 * @class
 * @classdesc Maps actions to an actual endpoints and provides access to this configuration
 */
var Context = function () {
    BaseContext.call(this);
    this.actionEndpointMap.authorise = 'payments';
    this.actionEndpointMap.createOrders = 'orders';
    this.actionEndpointMap.getOrders = 'orders/{0}';
};

Context.prototype = Object.create(BaseContext.prototype);

/**
 * @description returns a default endpoint.
 * It is called in case if nothing is mapped to provided action
 * @returns {string} - default API endpoint
 */
Context.prototype.getDefaultEndpoint = function () {
    return 'orders/{0}';
};

module.exports = Context;