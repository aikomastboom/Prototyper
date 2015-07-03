'use strict';
var ObjectID = require('mongodb').ObjectID;
var _        = require('underscore');


module.exports = function (config, db) {

	// config.database.pk = '_id'

	/*
	 *  options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 */
	function getMongoContent(options, callback) {
		config.debug && config.debug('getMongoContent options', options);
		if (!options.collection) {
			return callback && callback(new Error('Data not found / missing collection'));
		}
		return db.collection(options.collection, function collection(err, col) {
			if (err) {
				config.error && config.error('ERR2 getMongoContent', err);
				return callback && callback(err);
			}
			if (!options.query) {
				return callback && callback(new Error('Data not found ' + options.collection + ' / missing query'), null, col);
			}
			if (options.query._id && !(options.query._id instanceof Object)) {
				try {
					options.query._id = new ObjectID.createFromHexString(options.query._id);
				} catch (error) {
					config.error && config.error('ERR3 getMongoContent', error);
					return callback && callback(error);
				}
			}
			return col.findOne(options.query, function foundOne(err, result) {
				if (err) {
					config.error && config.error('ERR4 getMongoContent', err);
					return callback && callback(err);
				}
				if (!result) {
					return callback && callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)), null, col);
				}
				return callback && callback(null, result, col);
			});
		});
	}


	/*
	 *  options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 *	attribute (mandatory)
	 */
	function getMongoAttribute(options, callback) {
		config.debug && config.debug('getMongoAttribute options', options);
		return getMongoContent(options, function document(err, result, col) {
			if (err) {
				config.error && config.error('ERR1 getMongoAttribute', err);
				return callback && callback(err);
			}
			if (!options.attribute) {
				return callback && callback(new Error('Data not found / ' + options.collection + '/' + JSON.stringify(options.query) + ' missing attribute', null, col));
			}
			var attribute_options = null;
			config.debug && config.debug('getMongoAttribute result', result);
			if (result &&
				result.hasOwnProperty(options.attribute) &&
				result[options.attribute].guid) {
				attribute_options = {
					collection: options.collection,
					query:      {_id: result[options.attribute].guid}
				};
				config.debug && config.debug('getMongoAttribute attribute_options', attribute_options);

				getMongoContent(attribute_options, function attribute(err, attribute_result, coll) {
					if (err) {
						config.error && config.error('ERR2 getMongoAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getMongoAttribute attribute_result', attribute_result);
					return callback && callback(err, attribute_result, coll);
				});
			} else {
				config.debug && config.debug('getMongoAttribute try direct lookup');
				attribute_options = {
					collection: options.collection,
					query:      {
						parent: result._id,
						name:   result.name + '.' + options.attribute
					}
				};
				config.debug && config.debug('getMongoAttribute attribute_options', attribute_options);

				return getMongoContent(attribute_options, function attribute(err, attribute_result, coll) {
					if (err) {
						config.error && config.error('ERR getMongoAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getMongoAttribute direct attribute_result', attribute_result);
					return callback && callback(err, attribute_result, coll);
				});
			}
		});
	}

	function saveData(collection, data, callback) {
		if (data._id && !(data._id instanceof Object)) {
			data._id = new ObjectID.createFromHexString(data._id);
		}
		config.debug && config.debug('saveData saving', data._id);
		collection.save(data, {safe: true}, function (err, result2, result3) {
			if (err) {
				config.error && config.error('ERR saveData', err);
				return callback && callback(err);

			}
			config.debug && config.debug('saveData saved', data._id, result2, result3);
			return callback && callback(null, data, collection);
		});
	}

	var updating = false;

	function updateData(collection, data, callback) {
		if (updating) {
			//noinspection JSUnresolvedFunction
			setImmediate(function rescheduling() {
				config.debug && config.debug('Updating, rescheduling');
				return updateData(collection, data, callback);
			});
		} else {
			updating         = true;
			var stopUpdating = function (err, result, col) {
				config.debug && config.debug('Stop updating');
				updating = false;
				if (err) {
					return callback && callback(err);
				}
				return callback && callback(null, result, col);
			};

			return collection.findOne({_id: data._id}, function foundOne(err, result) {
				if (err) {
					config.error && config.error('ERR updateData', err);
					return callback && callback(err);
				}
				_.extend(result, data);
				return saveData(collection, result, stopUpdating);
			});
		}
	}


	/*
	 * options:
	 * collection (mandatory)
	 * query (mandatory)
	 * operation (optional) : version info
	 * update (optional) : extends existing content
	 */
	function setMongoContent(data, options, callback) {
		config.debug && config.debug('setMongoContent options', options);
		return db.collection(options.collection, function handleCollection(err, collection) {
			if (err) {
				config.error && config.error('ERR2 setMongoContent', err);
				return callback && callback(err);
			}
			if (options.operation && options.operation.v) {
				data.version = options.operation.v;
			}
			var dumpData = saveData;
			if (options.update) {
				dumpData = updateData;
			}
			if (!data._id) {
				config.debug && config.debug('setMongoContent lookup by query', options.query, 'updating:', options.update);
				collection.findOne(options.query, function foundOne(err, result) {
					if (err) {
						config.error && config.error('ERR3 setMongoContent', err);
						return callback && callback(err);
					}
					if (result && result._id) {
						data._id = result._id;
					}
					return dumpData(collection, data, callback);
				});
			} else {
				return dumpData(collection, data, callback);
			}
		});
	}

	return {
		saveData:     saveData,
		updateData:   updateData,
		getAttribute: getMongoAttribute,
		getContent:   getMongoContent,
		setContent:   setMongoContent
	};
};
