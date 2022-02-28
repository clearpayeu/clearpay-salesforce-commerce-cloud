'use strict';

var server = require('server');

var Page = module.superModule;
server.extend(Page);

server.append(
    'SetLocale',
    function (req, res, next) {
        var { brandUtilities: cpBrandUtilities } = require('*/cartridge/scripts/util/clearpayUtilities');

        cpBrandUtilities.initBrand(req.querystring.code);

        return next();
    }
);

module.exports = server.exports();
