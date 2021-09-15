var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

describe('ClearPayWidget-GetUpdatedWidget', function () {
    this.timeout(25000);

    var myRequest = {
        url: '',
        method: 'GET',
        resolveWithFullResponse: true
    };

    it('should successfully return ClearPay widget HTML', function () {
    	myRequest.url = config.baseUrl + '/ClearpayWidget-GetUpdatedWidget?productID=750518699578&updatedProductPrice=299.99';
        request(myRequest, function (error, response) {
        	assert.equal(response.statusCode, 200, 'Expected get updated widget request statusCode to be 200.');
        	
        	var bodyAsJson = JSON.parse(response.body);

            assert.isFalse(bodyAsJson.error);
        });
    });
});