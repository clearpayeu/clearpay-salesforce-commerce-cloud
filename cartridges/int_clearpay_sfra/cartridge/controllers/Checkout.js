'use strict';

var server = require('server');

var Checkout = module.superModule;
server.extend(Checkout);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

/**
 * Main entry point for Checkout
 */

/**
* overrides Begin method to show clearpay error message
*/
server.append(
    'Begin',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var clearpayErrorResponse = req.querystring.clearpayErrorMessage;
        var clearpayForm = server.forms.getForm('clearpay');
        var {sitePreferencesUtilities} = require('*/cartridge/scripts/util/clearpayUtilities');
        var priceContext;
        if(sitePreferencesUtilities.isClearpayEnabled()){
            priceContext = require('*/cartridge/scripts/util/getTemplateSpecificWidget').getCheckoutWidgetData(
                currentBasket,
                'checkout-clearpay-message',
                req.locale.id
            );

            res.render('checkout/checkout', {
                clearpayApiError: clearpayErrorResponse,
                priceContext: priceContext,
                customForms: {
                    clearpayForm: clearpayForm
                }
            });
        }
        
        return next();
    }
);


module.exports = server.exports();
