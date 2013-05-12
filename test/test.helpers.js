var helpers = require('../lib/helpers.js');
var expect = require('chai').expect;
var when = require('when');


describe('Helpers', function () {
	var marker_prefix = '<!--\\s*@@';
	var marker_postfix = '\\s*-->';
	var helper = helpers({
		prefix: marker_prefix,
		postfix: marker_postfix
	});

	describe('replace', function (done) {
		it('', function () {
			var promise = helper.replace(null, null, null, true);
			expect(promise).to.be.an('object');
			when(promise).then(
				function onSuccess(result) {
					expect(result).to.be.an('object');
					expect(result).to.be.empty();
					done();
				}, function onFailure(err) {
					done(err);
				}
			);
		})
	});
});
