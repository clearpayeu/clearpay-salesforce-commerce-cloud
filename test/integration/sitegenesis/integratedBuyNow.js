var assert = require('chai').assert;
const puppeteer = require('puppeteer');
const { expect } = require('chai');
const _ = require('lodash');
var request = require('request-promise');
var config = require('../it.config');
const globalVariables = _.pick(global, ['browser', 'expect']);
const ecUtils = require('../testUtilsSitegenesis');

// puppeteer options
const opts = {
    headless: false,
    slowMo: 100,
    timeout: 30000
};

// expose variables
before (async function () {
    global.expect = expect;
    global.browser = await puppeteer.launch(opts);
});
  
// close browser and reset global variables
after (function () {
    browser.close();
    global.browser = globalVariables.browser;
    global.expect = globalVariables.expect;
});
  
describe('sample test', function () {
    it('should work', async function () {
        console.log(await browser.version());
        expect(true).to.be.true;
    }).timeout(10000);
});

describe('Integrated Non-BuyNow', function () {
    this.timeout(0);
    let page;
    let homeUrl = config.sgBaseUrl;
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

  it('Main home page', async function () {
    let trackingConsentOkButton = await page.waitForSelector('button.ui-widget:nth-child(1)');
    await trackingConsentOkButton.click();

    let searchInput = await page.waitForSelector('input#q');
    await searchInput.type('sanyo dp19648');
    await page.keyboard.press('Enter');

    //await page.waitFor('#electronics-gps-units');
    //await page.click('#electronics-gps-units');
    //await page.waitForSelector('a.link');
    //await page.click('a.link');

    await page.waitForSelector('#clearpay-express-link-button');

    messaging = await page.$eval('.pdp-clearpay-message', e => e.innerText);
    expect(messaging).to.contain('or 4 payments of');

    let addToCartButton = await page.waitForSelector('button#add-to-cart');
    await addToCartButton.click();

    //let cartQuantity = await ecUtils.checkCartQuantity(page);
    // Wait for cart quantity to be 1
    await page.waitForFunction('document.querySelector(".minicart-quantity").innerText.trim() === "1"');

    let miniCartLink = await page.waitForSelector('.mini-cart-link');
    await miniCartLink.click();

    let checkoutButton = await page.waitForSelector('#clearpay-express-button');

    await checkoutButton.click();

    const newPagePromise = new Promise(x => page.once('popup', x));
    const cpCheckout = await newPagePromise;
    await ecUtils.popupLogin(cpCheckout, ecUtils.user.email, ecUtils.user.password);


    // Click on confirm button when first installment amount is shown

    const gotItButton = await cpCheckout.waitForSelector('button[automation_id="button-confirmPaymentUpFront');
    await gotItButton.click();


    // Click on the first shipping option
    await cpCheckout.waitForSelector('div > label:nth-child(1) input[type="radio"]');
    await cpCheckout.$eval('div > label:nth-child(1) input[type="radio"]', e => e.click());

    // Give the price time to update
    await page.waitForTimeout(2000)


    // Count the number of shipping options. There should be 3
    let numShipOptions = await ecUtils.popupCountNumberShipOptions(cpCheckout);
    expect(numShipOptions).to.equal(2);


    // Grab the price
    firstTotalPrice = await ecUtils.popupGetTotalPrice(cpCheckout);
    expect(firstTotalPrice).to.equal('261.97');


    // Click on the second shipping option
    await cpCheckout.waitForSelector('div > label:nth-child(2) input[type="radio"]');
    await cpCheckout.$eval('div > label:nth-child(2) input[type="radio"]', e => e.click());
    // Give the price time to update
    await page.waitForTimeout(2000)

    // Grab the price
    secondTotalPrice = await ecUtils.popupGetTotalPrice(cpCheckout);
    expect(secondTotalPrice).to.equal('268.27');

    // Click the change address button
    const changeAddressButton = await cpCheckout.waitForSelector('button[content-key="checkout.action.change"]');
    await changeAddressButton.click();

    // Choose the third address, which is a HI address
    await cpCheckout.waitForSelector('div.drawer__body > div[role="button"]:nth-child(3)');
    await page.waitForTimeout(1000)

    const addressOption3 = await cpCheckout.waitForSelector('div.drawer__body > div[role="button"]:nth-child(3)');
    //console.log("Option 3: ", addressOption3);
    await addressOption3.click();

    // Wait for new shipping options to appear again:
    await page.waitForTimeout(2000)

    // Count the number of shipping options. There should be 1
    let numHawaiiShipOptions = await ecUtils.popupCountNumberShipOptions(cpCheckout);
    //let numHawaiiShipOptions = (await cpCheckout.$$('div > label input[type="radio"]')).length;
    expect(numHawaiiShipOptions).to.equal(1);


    // Select the first option
    await ecUtils.popupClickOnShippingOption(cpCheckout, 1);

    // Give the price time to update
    await page.waitForTimeout(2000);

    // Grab the price
    thirdTotalPrice = await ecUtils.popupGetTotalPrice(cpCheckout);
    expect(thirdTotalPrice).to.equal('281.92');


    const confirmAgreement = await cpCheckout.waitForSelector('span.checkbox__tick');
    await confirmAgreement.click();

    // Wait for button to not be disabled
    const reviewOrderButton = await cpCheckout.waitForSelector('button[automation_id="button-submit"]:not([disabled])');
    await reviewOrderButton.click();

    // Check for the thank you page
    await page.waitForSelector('.confirmation-message');
    await ecUtils.verifyShippingAddressOnThankYouPage(page, ecUtils.accountAddress3);
    await ecUtils.verifyBillingAddressOnThankYouPage(page, ecUtils.accountAddress3);
  }).timeout(10000);
});
