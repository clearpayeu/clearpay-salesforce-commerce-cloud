'use strict';

var server = require('server');
var cache = require('*/cartridge/scripts/middleware/cache');
var cpBrandUtilities = require('*/cartridge/scripts/util/clearpayUtilities').brandUtilities;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var Page = module.superModule;
server.extend(Page);

server.append(
    'SetLocale',
    function (req, res, next) {
        cpBrandUtilities.initBrand(request.locale);
        thresholdUtilities.getThresholdAmounts();
        return next();
    }
);

server.append(
    'Include',
    server.middleware.include,
    cache.applyDefaultCache,
    function (req, res, next) {
        cpBrandUtilities.initBrand(request.locale);
        thresholdUtilities.getThresholdAmounts();
        return next();
    }
);

module.exports = server.exports();
