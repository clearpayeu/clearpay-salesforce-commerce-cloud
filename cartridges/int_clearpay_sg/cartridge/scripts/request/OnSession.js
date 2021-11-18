var Status = require('dw/system/Status');

/**
 * The onSession hook function.
 * @returns {dw.system.Status} status
 */
exports.onSession = function () {
    var { brandUtilities } = require('*/cartridge/scripts/util/clearpayUtilities');

    brandUtilities.initBrand(request.locale);
    return new Status(Status.OK);
};
