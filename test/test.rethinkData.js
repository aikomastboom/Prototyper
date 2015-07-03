'use strict';
//noinspection JSUnresolvedVariable
var libPath              = process.env.PROTOTYPER_COV ? '../lib-cov' : '../lib';
var chai                 = require('chai');
chai.config.includeStack = true; // defaults to false
chai.config.showDiff = false; // defaults to false
var expect = chai.expect;

var rethinkData = require(libPath + '/rethinkData.js');
var config    = {
	debug: function () {
		//console.log(arguments);
	},
	info: function () {
		//console.log(arguments);
	},
	warn: function () {
		//console.error(arguments);
	},
	error: function () {
		//console.error(arguments);
	}
};

describe('rethinkData', function () {
	describe('getContent', function () {

		var db                = {
			tableList: function(){
				return this;
			},
			contains: function(){
				return this;
			},
			do: function(){
				return this;
			},
			run: function(c,callback){
				return callback(new Error());
			}
		};
		var shareModel        = {};
		var option_list       = [
			{}, // no collection
			{query: 'q'}, // no collection
			{collection: 'test_error'}, // bad collection
			{collection: 'col'}, // no query
			{
				collection: 'no_hex',
				query:      {id: 'id'} // not a hexString
			},
			{
				collection: 'no_col', // trigger findOne error
				query:      {id: '123456789012345678901234'}
			},
			{
				collection: 'col', // trigger null result
				query:      {id: '234567890123456789012345'}
			},
			{
				collection: 'col', // trigger '' result
				query:      {id: '345678901234567890123456'}
			},
			{
				collection: 'ok', // trigger 'ok' result
				query:      {id: '456789012345678901234567'}
			}
		];
		var dataInstance = rethinkData(config, db, 'ok', shareModel);
		var i;

		function testArguments(options) {
			return function (done) {
				dataInstance.getContent(options, function (err, result) {
					if (result === 'ok') {
						expect(result).to.equal('ok');
						expect(err).to.not.be.ok;
						done();
					} else {
						expect(err).to.be.instanceOf(Error);
						expect(result).to.not.be.ok;
						done();
					}
				});
			};
		}

		for (i = 0; i < option_list.length; i += 1) {
			it('should handle arguments correctly ' + JSON.stringify(option_list[i]),
				testArguments(option_list[i])
			);
		}
	});

	describe('getContentAttribute', function () {
		var ok = {
			id: '345678901234567890123456',
			parent: '456789012345678901234567',
			name: 'test.content_attribute'
		};
		function findOne(q, cb) {
			if (q._id && q._id.toString() === '123456789012345678901234') {
				return cb(null, {
					id: '123456789012345678901234',
					name: 'test',
					error_attribute: {
						guid: '234567890123456789012345'
					},
					content_attribute: {
						guid: '345678901234567890123456'
					}
				});
			}
			if (q.id && q.id === '234567890123456789012345') {
				return cb(new Error(q));
			}
			if (q.id && q.id === '345678901234567890123456') {
				return cb(null, ok);
			}
			if (q.id && q.id === '456789012345678901234567') {
				return cb(null, {
					id: '456789012345678901234567',
					name: 'test'
				});
			}
			if (q.parent && q.parent.toString() === '456789012345678901234567') {
				if (q.name === 'test.content_attribute'){
					return cb(null, ok);
				} else {
					return cb(new Error(q));
				}
			}
			throw new Error('fail:' + JSON.stringify(arguments));
		}

		var col               = {findOne: findOne};
		var db                = {
			tableList: function(){
				return this;
			},
			contains: function(){
				return this;
			},
			do: function(){
				return this;
			},
			run: function(c,callback){
				return callback(new Error());
			}
		};
		var shareModel        = {};
		var option_list       = [
			{}, // no collection
			{query: 'q'}, // no collection
			{collection: 'col'}, // no query
			{
				collection: 'no_attr',
				query:      {id: '123456789012345678901234'} // no attribute
			},
			{
				collection: 'col', // trigger null result
				query:      {id: '123456789012345678901234'},
				attribute: 'error_attribute'
			},
			{
				collection: 'ok', // trigger 'ok' result
				query:      {id: '123456789012345678901234'},
				attribute: 'content_attribute'

			},
			{
				collection: 'col', // trigger error result
				query:      {id: '456789012345678901234567'},
				attribute: 'error_attribute'
			},
			{
				collection: 'ok', // trigger 'ok' result
				query:      {id: '456789012345678901234567'},
				attribute: 'content_attribute'
			}
		];
		var dataInstance = rethinkData(config, db, shareModel);
		var i;

		function testArguments(options) {
			return function (done) {
				dataInstance.getAttribute(options, function (err, result) {
					if (options.collection === 'ok') {
						//console.log('result',result,'err',err,'coll',coll);
						expect(result).to.equal(ok);
						expect(err).to.not.be.ok;
						done();
					} else {
						//console.log('err',err);
						expect(err).to.be.instanceOf(Error);
						expect(result).to.not.be.ok;
						done();
					}
				});
			};
		}

		for (i = 0; i < option_list.length; i += 1) {
			it('should handle arguments correctly ' + JSON.stringify(option_list[i]),
				testArguments(option_list[i])
			);
		}
	});
});
