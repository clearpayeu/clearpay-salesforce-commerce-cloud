'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('./clearpay/clearpayContent'));
    processInclude(require('./clearpay/customCheckout'));
});
