/* eslint-disable no-new-wrappers */
'use strict';

/**
*
* Controller to render the Clearpay messages and terms
*/

/* API Includes */
var Money = require('dw/value/Money');

/* Script Modules */
var { brandUtilities: BrandUtilities, sitePreferencesUtilities: SitePreferences } = require('*/cartridge/scripts/util/clearpayUtilities');
var ctrlCartridgeName = SitePreferences.getControllerCartridgeName();
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');

var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var guard = require(ctrlCartridgeName + '/cartridge/scripts/guard');

/**
 * Renders Clearpay/CLearpay messages
 */
function renderMessage() {
    var params = request.httpParameterMap;
    var totalprice = parseFloat(params.totalprice.stringValue);
    var classname = params.classname.stringValue;
    var clearpayBrand = params.clearpayBrand.stringValue;
    var applyCaching;

    if (totalprice && !isNaN(totalprice)) {
        totalprice = new Money(totalprice, session.currency);
    } else {
        return;
    }

    var isWithinThreshold = thresholdUtilities.checkThreshold(totalprice);
    var clearpayApplicable = BrandUtilities.isClearpayApplicable();

    clearpayApplicable = isWithinThreshold.status && clearpayApplicable;

    if (classname !== 'cart-clearpay-message') {
        applyCaching = true;
    }

    if (clearpayApplicable) {
        app.getView({
            applyCaching: applyCaching,
            belowThreshold: isWithinThreshold.belowThreshold,
            classname: classname,
            clearpaybrand: clearpayBrand,
            totalprice: totalprice.value
        }).render('product/components/clearpaymessage');
    }
}

/**
 * @description Remove include of Clearpay js library needed to render badges and installments
 */
function includeClearpayLibrary() {
    var scope = {
        isClearpayEnabled: SitePreferences.isClearpayEnabled()
    };

    if (scope.isClearpayEnabled) {
        scope.thresholdAmounts = thresholdUtilities.getThresholdAmounts(BrandUtilities.getBrand());
    }

    app.getView(scope).render('util/clearpayLibraryInclude');
}

/* Web exposed methods */

exports.RenderMessage = guard.ensure(['get'], renderMessage);
exports.IncludeClearpayLibrary = guard.ensure(['get'], includeClearpayLibrary);
