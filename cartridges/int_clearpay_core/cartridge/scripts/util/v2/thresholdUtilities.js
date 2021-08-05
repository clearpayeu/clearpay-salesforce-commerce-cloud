var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

thresholdUtilities.parseConfigurationResponse = function (thresholdResponse) {
    var configuration = {
        minAmount: 0,
        maxAmount: 0
    };

    if (thresholdResponse) {
        var minThresholdObj = thresholdResponse.minimumAmount;
        var maxThresholdObj = thresholdResponse.maximumAmount;

        if (minThresholdObj) {
            configuration.minAmount = parseFloat(minThresholdObj.amount, 10);
        }

        if (maxThresholdObj) {
            configuration.maxAmount = parseFloat(maxThresholdObj.amount, 10);
        }
    }

    return configuration;
};

module.exports = thresholdUtilities;
