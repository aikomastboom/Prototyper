"use strict";
var libPath = process.env.PROTOTYPER_COV ? '../lib-cov' : '../lib';
var chai = require('chai');
chai.config.includeStack = true; // defaults to false
var expect = chai.expect;

var mongoData = require(libPath + '/mongoData.js');
var config = {
	debug: function () {
		//console.log(arguments);
	},
	error: function () {
		//console.error(arguments);
	}
};

describe('mongoData', function () {
	describe('getMongoContent', function () {

		function findOne(q, cb) {
			//console.log('findOne', arguments);
			if (q._id.toString() === '123456789012345678901234') {
				return cb(new Error(q));
			}
			if (q._id.toString() === '234567890123456789012345') {
				return cb(null, null);
			}
			if (q._id.toString() === '345678901234567890123456') {
				return cb(null, '');
			}
			if (q._id.toString() === '456789012345678901234567') {
				return cb(null, 'ok');
			}
			throw new Error('fail:' + JSON.stringify(arguments));
		}

		var col = {findOne: findOne};
		var db = { collection: function (c, cb) {
			//console.log('collection arguments', arguments);
			if (c === 'test_error') {
				return cb(new Error(c));
			}
			return cb(null, col);
		}};
		var shareModel = {};
		var option_list = [
			{}, // no collection
			{query: 'q'}, // no collection
			{collection: 'test_error'}, // bad collection
			{collection: 'col'}, // no query
			{collection: 'no_hex',
				query: {_id: 'id'} // not a hexString
			},
			{collection: 'no_col', // trigger findOne error
				query: {_id: '123456789012345678901234'}
			},
			{collection: 'col', // trigger null result
				query: {_id: '234567890123456789012345'}
			},
			{collection: 'col', // trigger '' result
				query: {_id: '345678901234567890123456'}
			},
			{collection: 'ok', // trigger 'ok' result
				query: {_id: '456789012345678901234567'}
			}
		];
		var mongoDataInstance = mongoData(config, db, shareModel);
		var i;

		function testArguments(options) {
			return function (done) {
				mongoDataInstance.getMongoContent(options, function (err, result, coll) {
					if (options.collection === 'ok') {
						expect(result).to.equal('ok');
						expect(err).to.not.be.ok;
						expect(coll).to.equal(col);
						done();
					} else {
						expect(err).to.be.instanceOf(Error);
						expect(result).to.not.be.ok;
						if (options.collection === 'col') {
							expect(coll).to.equal(col);
						} else {
							expect(coll, JSON.stringify(options)).to.not.be.ok;
						}
						done();
					}
				});
			};
		}

		for (i = 0; i < option_list.length; i += 1) {
			it('should handle arguments correctly', testArguments(option_list[i]));
		}
	});
});
