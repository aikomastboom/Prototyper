'use strict';
//noinspection JSUnresolvedVariable
var libpath = process.env.PROTOTYPER_COV ? '../lib-cov' : '../lib';

var helpers              = require(libpath + '/helpers.js');
var markers              = require(libpath + '/markers.js');
var chai                 = require('chai');
chai.config.includeStack = true; // defaults to false
chai.config.showDiff = false; // defaults to false
var expect = chai.expect;
var when   = require('when');


describe('Helpers', function () {
	var config          = {
		debug: function () {
			//console.log(arguments);
		},
		error: function () {
			//console.error(arguments);
		}
	};
	var markersInstance = markers(config);
	var marker_prefix   = '<!--\\s*@@';
	var marker_postfix  = '\\s*-->';
	var helper          = helpers({
		prefix:  marker_prefix,
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

			var i, values = [null, undefined, '', 'hello', {}, []];
			for (i = 0; i < values.length; i += 1) {
				it('should ignore non text input ' + values[i], testText(values[i]));
			}
		});

		describe('check getReplacement', function () {

			it('should call getReplacement fail on error', function (done) {
				var marker = '<!-- @@null -->';
				var text   = 'hello' + marker + 'world';

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

			it('should call getReplacement (once)', function (done) {
				var marker = '<!-- @@null -->';
				var text   = 'Hello' + marker + 'World' + marker + '!!';

				function getReplacement(result, callback) {
					expect(result).to.be.equal(marker);
					expect(callback).to.be.a('function');
					callback(null, {});
				}

				var once    = true;
				var promise = helper.replace(text, null, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try {
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(1); // due to once == true
							expect(result[0]).to.be.ok;
							expect(result[0].replacement).to.not.be.ok;
							expect(result[0]).to.have.property('regExp');
							expect(result[0].regExp.source).to.equal('<!--\\s*@@null\\s*-->');
						} catch (e) {
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
				var text   = 'Hello' + marker + 'World' + marker + '!!';

				function getReplacement(result, callback) {
					expect(result).to.be.equal(marker);
					expect(callback).to.be.a('function');
					callback(null, {
						regExp: new RegExp('What?'),
						value:  '#'
					});

				}

				var once    = false;
				var promise = helper.replace(text, null, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try {
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(2); // due to 'once' being false
							var i;
							for (i = 0; i < result.length; i += 1) {
								expect(result[i]).to.be.ok;
								expect(result[i]).to.have.property('replacement', '#');
								expect(result[i]).to.have.property('regExp');
								expect(result[i].regExp.source).to.equal('What?');
							}
						} catch (e) {
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

		describe('complex regexp', function () {

			it('should handle variable tags', function (done) {
				var marker_tag = 'test__([A-Za-z0-9]+)';
				var marker1    = '<!-- @@test__A -->';
				var marker2    = '<!-- @@test__B -->';
				var text       = 'Hello' + marker1 + 'World' + marker2 + '!!';
				var called     = 0;

				function getReplacement(result, callback) {
					if (called) {
						expect(result).to.be.equal(marker2);
					} else {
						called += 1;
						expect(result).to.be.equal(marker1);
					}
					expect(callback).to.be.a('function');
					callback(null, {
						regExp: new RegExp('What?'),
						value:  '#'
					});

				}

				var once    = false;
				var promise = helper.replace(text, marker_tag, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try {
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(2); // due to 'once' being false
							var i;
							for (i = 0; i < result.length; i += 1) {
								expect(result[i]).to.be.ok;
								expect(result[i]).to.have.property('replacement', '#');
								expect(result[i]).to.have.property('regExp');
								expect(result[i].regExp.source).to.equal('What?');
							}
						} catch (e) {
							// work around 'when eating exceptions'
							return done(e);
						}
						done();
					}, function onFailure(err) {
						done(new Error(JSON.stringify(err)));
					}
				);

			});

			it('should handle tags in tags', function (done) {
				var marker_tag = 'test_([A-Za-z0-9]+)__([\\w\\W]*?)__\\1_test';
				var marker1    = '<!-- @@test_A__ -->';
				var marker2    = '<!-- @@__A_test -->';
				var marker3    = '<!-- @@test_B____B_test -->';
				var text       = 'Hello' + marker1 + 'World' + marker2 + '!!' + marker3 +
					'Greetings' + marker1 + 'Earthlings' + marker3 + '!!' + marker2;
				var called     = 0;

				function getReplacement(result, callback) {
					//console.log('result',called,result);
					if (called === 2) {
						expect(result).to.be.equal('<!-- @@test_A__ -->Earthlings<!-- @@test_B____B_test -->!!<!-- @@__A_test -->');
					} else if (called === 1) {
						expect(result).to.be.equal('<!-- @@test_B____B_test -->');
					} else {
						expect(result).to.be.equal('<!-- @@test_A__ -->World<!-- @@__A_test -->');
					}
					called += 1;
					expect(callback).to.be.a('function');
					callback(null, {
						regExp: new RegExp('What?'),
						value:  '#'
					});

				}

				var once    = false;
				var promise = helper.replace(text, marker_tag, getReplacement, once);
				expect(when.isPromise(promise)).to.be.ok;
				promise.then(
					function onSuccess(result) {
						try {
							expect(result).to.be.instanceof(Array);
							expect(result).to.have.length(3); // due to 'once' being false
							var i;
							for (i = 0; i < result.length; i += 1) {
								expect(result[i]).to.be.ok;
								expect(result[i]).to.have.property('replacement', '#');
								expect(result[i]).to.have.property('regExp');
								expect(result[i].regExp.source).to.equal('What?');
							}
						} catch (e) {
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

	describe('handTextManipulation', function () {

		function testText(text) {
			return function (done) {
				helper.handTextManipulation(text, [], null, function (err, handledText) {
					try {
						expect(text).to.equal(handledText);
					} catch (e) {
						return done(e);
					}
					done();
				});
			};
		}

		var i, values = [null, undefined, '', 'hello', {}, []];
		for (i = 0; i < values.length; i += 1) {
			it('should return input when there are no promisses ' + values[i], testText(values[i]));
		}

		it('should callback with an error when one of the promises fails', function (done) {
			var d1 = when.defer();
			var p1 = d1.promise;
			d1.resolve('good');
			var d2 = when.defer();
			var p2 = d2.promise;
			d2.reject('fail');

			helper.handTextManipulation(null, [p1, p2], null, function (err, handledText) {
				try {
					expect(err).to.equal('fail');
				} catch (e) {
					return done(e);
				}
				done();
			});
		});

		it('should callback with an error when handler is missing', function (done) {
			var d1 = when.defer();
			var p1 = d1.promise;
			d1.resolve('good');
			var d2 = when.defer();
			var p2 = d2.promise;
			d2.resolve('fine');

			helper.handTextManipulation(null, [p1, p2], null, function (err, handledText) {
				try {
					expect(err).to.be.an.instanceof(Error);
					expect(handledText).to.not.be.ok;
				} catch (e) {
					return done(e);
				}
				done();
			});

		});

		it('should callback with an error when handler is missing', function (done) {
			var d1 = when.defer();
			var p1 = d1.promise;
			d1.resolve(['good', 'better', 'best']);
			var d2 = when.defer();
			var p2 = d2.promise;
			d2.resolve(['fine', 'finer']);

			function handler(text, result) {
				return text.replace(result, '---');
			}

			var text = 'better than fine';
			helper.handTextManipulation(text, [p1, p2], handler, function (err, handledText) {
				try {
					expect(err).to.not.be.ok;
					expect(handledText).to.be.eql('--- than ---');
				} catch (e) {
					return done(e);
				}
				done();
			});

		});


	});

	describe('createTag', function () {
		it('should create a simple tag', function () {
			expect(markersInstance.createTag('type', 'collection', 'name', 'attribute')).
				to.be.equal('<!-- @@type__collection_name_attribute -->');
		});
	});
});
