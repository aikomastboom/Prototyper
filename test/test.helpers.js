var libpath = process.env.PROTOTYPER_COV ? '../lib-cov' : '../lib';

var helpers = require(libpath + '/helpers.js');
var markers = require(libpath + '/markers.js');
var chai = require('chai');
chai.Assertion.includeStack = true; // defaults to false
var expect = chai.expect;
var when = require('when');


describe('Helpers', function () {
	"use strict";
	var config = { debug: false };
	var markersInstance = markers(config);
	var marker_prefix = '<!--\\s*@@';
	var marker_postfix = '\\s*-->';
	var helper = helpers({
		prefix: marker_prefix,
		postfix: marker_postfix
	});

	describe('replace', function () {

		describe('non matching text input', function () {
			function testText(text) {
				return function testText(done) {
					function onSuccess(result) {
						try {
							expect(result).to.be.an('object');
							expect(result).to.be.empty;
						} catch (e) {
							return done(e);
						}
						done();
					}

					function onFailure(err) {
						done(err);
					}

					var promise = helper.replace(text, null, null, true);
					expect(when.isPromise(promise)).to.be.ok;
					promise.then(onSuccess, onFailure);
				};
			}

			var i, values = [ null, undefined, '', 'hello', {}, []];
			for (i=0; i < values.length; i += 1) {
				it('should ignore non text input ' + values[i], testText(values[i]));
			}
		});
		describe('check getReplacement', function () {

			it('should call getReplacement fail on error', function (done) {
				var marker = '<!-- @@null -->';
				var text = 'hello' + marker + 'world';

				function getReplacement(result, callback) {
					expect(result).to.be.equal(marker);
					expect(callback).to.be.a('function');
					callback('replacementError');
				}

				var promise = helper.replace(text, null, getReplacement, true);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						done(new Error(JSON.stringify(result)));
					}, function onFailure(err) {
						expect(err).to.equal('replacementError');
						done();
					}
				);
			});

			it('should call getReplacement', function (done) {
				var marker = '<!-- @@null -->';
				var text = 'Hello' + marker + 'World' + marker + '!!';

				function getReplacement(result, callback) {
					console.log('result', result);
					expect(result).to.be.equal(marker);
					expect(callback).to.be.a('function');
					callback(null, {});
				}
				var once = true;
				var promise = helper.replace(text, null, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try{
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(1); // due to once == true
							expect(result[0]).to.be.ok;
							expect(result[0].replacement).to.not.be.ok;
							expect(result[0]).to.have.property('regExp');
							expect(result[0].regExp.source).to.equal('<!--\\s*@@null\\s*-->');
						}catch(e){
							// work around 'when eating exceptions'
							return done(e);
						}
						done();
					}, function onFailure(err) {
						done(new Error(JSON.stringify(err)));
					}
				);
			});

			it('should call getReplacement', function (done) {
				var marker = '<!-- @@null -->';
				var text = 'Hello' + marker + 'World' + marker + '!!';

				function getReplacement(result, callback) {
					console.log('result', result);
					expect(result).to.be.equal(marker);
					expect(callback).to.be.a('function');
					callback(null, { value: '#'});

				}
				var once = false;
				var promise = helper.replace(text, null, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try{
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(2); // due to 'once' being false
							for(var i=0; i<result.length; i += 1) {
								expect(result[i]).to.be.ok;
								expect(result[i]).to.have.property('replacement','#');
								expect(result[i]).to.have.property('regExp');
								expect(result[i].regExp.source).to.equal('<!--\\s*@@null\\s*-->');
							}
						}catch(e){
							// work around 'when eating exceptions'
							return done(e);
						}
						done();
					}, function onFailure(err) {
						done(new Error(JSON.stringify(err)));
					}
				);
			});


		});
	});
});
