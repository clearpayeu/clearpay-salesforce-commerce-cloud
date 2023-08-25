'use strict';

/* eslint-disable no-new-wrappers */
/**
*
* Controller to render the Clearpay messages and terms
*/

/* API Includes */
var Money = require('dw/value/Money');

/* Script Modules */
var BrandUtilities = require('*/cartridge/scripts/util/clearpayUtilities').brandUtilities;
var SitePreferences = require('*/cartridge/scripts/util/clearpayUtilities').sitePreferencesUtilities;
var ctrlCartridgeName = SitePreferences.getControllerCartridgeName();
var thresholdUtilities = require('*/cartridge/scripts/util/thresholdUtilities');
var ClearpayCOHelpers = require('*/cartridge/scripts/checkout/clearpayCheckoutHelpers');

var app = require(ctrlCartridgeName + '/cartridge/scripts/app');
var guard = require(ctrlCartridgeName + '/cartridge/scripts/guard');

/**
 * Renders Clearpay/CLearpay messages
 */
function renderMessage() {
    var params = request.httpParameterMap;
    var totalprice = parseFloat(params.totalprice.stringValue);
    var classname = params.classname.stringValue;
    var applyCaching;

    if (totalprice && !(totalprice.isNaN)) {
        totalprice = new Money(totalprice, session.currency);
    } else {
        return;
    }

    var clearpayApplicable = BrandUtilities.isClearpayApplicable();
    var isEligible = true;

    if (classname !== 'cart-clearpay-message') {
        applyCaching = true;
        var reqProductID = params.productID.stringValue;
        isEligible = !ClearpayCOHelpers.checkRestrictedProducts(reqProductID);
    } else {
        isEligible = !ClearpayCOHelpers.checkRestrictedCart();
    }

    var clearpayLimits = thresholdUtilities.checkThreshold(totalprice);

    if (clearpayApplicable) {
        app.getView({
            applyCaching: applyCaching,
            eligible: isEligible,
            classname: classname,
            mpid: clearpayLimits.mpid,
            totalprice: totalprice.value
        }).render('product/components/clearpaymessage');
    }
}

/**
 * @description Remove include of Clearpay js library needed to render badges and installments
 */
function includeClearpayLibrary() {
    if (SitePreferences.isClearpayEnabled()) {
        var cpJavascriptURL = SitePreferences.getJavascriptURL();
        if (!empty(cpJavascriptURL)) {
            app.getView({
                cpJavascriptURL: cpJavascriptURL
            }).render('util/clearpayLibraryInclude');
        }
    }
}

/* Web exposed methods */

exports.RenderMessage = guard.ensure(['get'], renderMessage);
exports.IncludeClearpayLibrary = guard.ensure(['get'], includeClearpayLibrary);
