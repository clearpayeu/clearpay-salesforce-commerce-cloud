var Status = require('dw/system/Status');

/**
 * The onSession hook function.
 * @returns {dw.system.Status} status
 */
exports.onSession = function () {
    var ClearpayUtilities = require('*/cartridge/scripts/util/clearpayUtilities');
    var BrandUtilities = ClearpayUtilities.brandUtilities;

    BrandUtilities.initBrand(request.locale);
    return new Status(Status.OK);
};
