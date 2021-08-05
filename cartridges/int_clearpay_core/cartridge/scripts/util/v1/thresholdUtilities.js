var configurationType = require('*/cartridge/scripts/util/clearpayConstants.js').CONFIGURATION_TYPE;
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

thresholdUtilities.parseConfigurationResponse = function (thresholdResponse) {
    var configuration = {
        minAmount: 0,
        maxAmount: 0
    };

    if (thresholdResponse.length > 0) {
        for (var i = 0; i < thresholdResponse.length; i++) {
            var threshold = thresholdResponse[i];
            if (threshold.type === configurationType.PAY_BY_INSTALLMENT) {
                var minAmount = parseFloat(threshold.minimumAmount.amount, 10);
                var maxAmount = parseFloat(threshold.maximumAmount.amount, 10);
                if ((minAmount - maxAmount) !== 0.0) {
                    configuration.minAmount = parseFloat(threshold.minimumAmount.amount, 10);
                    configuration.maxAmount = parseFloat(threshold.maximumAmount.amount, 10);
                    break;
                }
            }
        }
    }

    return configuration;
};

module.exports = thresholdUtilities;
