var assert = require('chai').assert;
const puppeteer = require('puppeteer');
const { expect } = require('chai');
const _ = require('lodash');
var request = require('request-promise');
var config = require('../it.config');
const globalVariables = _.pick(global, ['browser', 'expect']);
const ecUtils = require('../testUtilsSfra');

// puppeteer options
const opts = {
    headless: false,
    slowMo: 100,
    timeout: 30000
};

var accountAddress1 = {
    firstname: 'Tim',
    lastname: 'User',
    address1: '1500 Sherburne Hills Rd',
    state: 'CA',
    city: 'Danville',
    zipcode: '94506',
    phone: '4152222226'
};

// expose variables
before (async function () {
    global.expect = expect;
    global.browser = await puppeteer.launch(opts);
});
  
// close browser and reset global variables
after (function () {
//    browser.close();
    global.browser = globalVariables.browser;
    global.expect = globalVariables.expect;
});
  
describe('sample test', function () {
    it('should work', async function () {
        console.log(await browser.version());
        expect(true).to.be.true;
    }).timeout(10000);
});


describe('Deferred Non-BuyNow', function () {
    this.timeout(0);
    let page;
    let homeUrl = config.sfraBaseUrl;
    let firstTotalPrice = 0;
    let secondTotalPrice = 0;
    let thirdTotalPrice = 0;


    before (async function () {
        page = await browser.newPage();
        await page.goto(homeUrl);
    });
    
    after (async function () {
        //await page.close();
    })

    /**
     * Buy an item. After express checkout, change the shipping method, thus the cost will change as well.
     */
  it('Main home page', async function () {
    await page.waitForSelector('button.affirm');
    await page.click('button.affirm');
    //await page.waitFor('#electronics-gps-units');
    //await page.click('#electronics-gps-units');
    await page.waitForSelector('a.link');
    await page.click('a.link');
    await page.waitForSelector('#clearpay-express-pdp-button');

    messaging = await page.$eval('.clearpay-widget-message', e => e.innerText);
    expect(messaging).to.contain('or 4 payments of');

    const newPagePromise = new Promise(x => page.once('popup', x));

    await page.click('#clearpay-express-pdp-button');
    const cpCheckout = await newPagePromise;
    await ecUtils.popupLogin(cpCheckout, ecUtils.user.email, ecUtils.user.password);

    // Grab the price
    await cpCheckout.waitForSelector('div.ng-binding');
    await cpCheckout.waitForTimeout(500);
    const priceText1 = await cpCheckout.$eval('div.ng-binding', el => { return el.innerHTML });
    //console.log("Price: ", priceText1);

    let found = priceText1.match(/\$([0-9\.]+)/);
    expect(found.length).to.be.greaterThan(0);
    firstTotalPrice = found[1];
    expect(firstTotalPrice).to.equal('57.74');

    // click agree checkbox
    const confirmAgreement = await cpCheckout.waitForSelector('span.checkbox__tick');
    await confirmAgreement.click();

    // Wait for button to not be disabled
    const reviewOrderButton = await cpCheckout.waitForSelector('button[automation_id="button-submit"]:not([disabled])');
    await reviewOrderButton.click();

    // The popup should be closed now. Should be shipping stage
    await page.waitForSelector('#checkout-main[data-checkout-stage="shipping"]');

    //
    await ecUtils.verifyShippingAddressOnShippingPage(page, accountAddress1);

    const checkoutPriceText = await page.$eval('.grand-total-sum', e => { return e.innerHTML });
    found = checkoutPriceText.match(/\$([0-9\.]+)/);
    expect(found.length).to.be.greaterThan(0);
    let checkoutPrice = found[1];
    expect(checkoutPrice).to.equal(firstTotalPrice);

    await page.waitForTimeout(3000);

    // Select 2-Day shipping
    const twoDayShipRadio = await page.waitForSelector('input[type="radio"][value="002"]');
    await twoDayShipRadio.click();
    await page.waitForTimeout(2000);

    // Click the payment button
    const submitShipButton = await page.waitForSelector('button.submit-shipping');
    await submitShipButton.click();


    // Check for the clearpay widget
    //await page.waitForSelector('div[data-testid="ap-amount-due-today"]');
    // Click the place order button
    let placeOrderButton = await page.waitForSelector('#clearpay-placeorder-button', { visible: true });
    await placeOrderButton.click();

    await page.waitForTimeout(6000000);

    // Check for the thank you page
    await page.waitForSelector('.order-thank-you-msg');
    await ecUtils.verifyShippingAddressOnThankYouPage(page, ecUtils.accountAddress1);
    await ecUtils.verifyBillingAddressOnThankYouPage(page, ecUtils.accountAddress1);
  }).timeout(10000);
});

