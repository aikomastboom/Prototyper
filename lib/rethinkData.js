'use strict';
var _ = require('underscore');

module.exports = function (config, r, connection) {

	// config.database.pk = 'id'

	/*
	 *  options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 */
	function getRethinkContent(options, callback) {
		config.debug && config.debug('getRethinkContent options', options);
		if (!options.collection) {
			return callback && callback(new Error('Data not found / missing collection'));
		}
		if (!options.query) {
			return callback && callback(new Error('Data not found ' + options.collection + ' / missing query'));
		}
		return r.tableList()
			.contains(options.collection)
			.do(
			function table(containsTable) {
				return r.branch(
					containsTable,
					{exists: true},
					{exists: false}
				);
			})
			.run(connection, function table_exists(err, contains) {
				if (contains && contains.exists) {
					return r.table(options.collection)
						.filter(options.query)
						.run(connection, function filter_table(err, cursor) {
							if (err) {
								config.error && config.error('ERR4 getRethinkContent', err);
								return callback && callback(err);
							}
							return cursor.next(function first_item(err, result) {
								if (err) {
									if ((err.name === 'RqlDriverError') && (err.message === 'No more rows in the cursor.')) {
										return callback && callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)), null);
									}
									config.error && config.error('ERR4 getRethinkContent', err);
									return callback && callback(err);
								}
								if (!result) {
									return callback && callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)), null);
								}
								return callback && callback(null, result, options.collection);
							});
						});
				} else {
					return callback && callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)), null);
				}
			});
	}


	/*
	 *  options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 *	attribute (mandatory)
	 */
	function getRethinkAttribute(options, callback) {
		config.debug && config.debug('getRethinkAttribute options', options);
		return getRethinkContent(options, function document(err, result) {
			if (err) {
				config.error && config.error('ERR1 getRethinkAttribute', err);
				return callback && callback(err);
			}
			if (!options.attribute) {
				return callback && callback(new Error('Data not found / ' + options.collection + '/' + JSON.stringify(options.query) + ' missing attribute'));
			}
			var attribute_options = null;
			config.debug && config.debug('getRethinkAttribute result', result);
			if (result &&
				result.hasOwnProperty(options.attribute) &&
				result[options.attribute].guid) {
				attribute_options = {
					collection: options.collection,
					query:      {id: result[options.attribute].guid}
				};
				config.debug && config.debug('getRethinkAttribute attribute_options', attribute_options);

				getRethinkContent(attribute_options, function attribute(err, attribute_result, coll) {
					if (err) {
						config.error && config.error('ERR2 getRethinkAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getRethinkAttribute attribute_result', attribute_result);
					return callback && callback(err, attribute_result, coll);
				});
			} else {
				config.debug && config.debug('getRethinkAttribute try direct lookup');
				attribute_options = {
					collection: options.collection,
					query:      {
						parent: result.id,
						name:   result.name + '.' + options.attribute
					}
				};
				config.debug && config.debug('getRethinkAttribute attribute_options', attribute_options);

				return getRethinkContent(attribute_options, function attribute(err, attribute_result, coll) {
					if (err) {
						config.error && config.error('ERR getRethinkAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getRethinkAttribute direct attribute_result', attribute_result);
					return callback && callback(err, attribute_result, coll);
				});
			}
		});
	}

	function saveData(collection, data, callback) {
		config.debug && config.debug('saveData saving', data.id, data.guid, collection);
		r.table(collection).insert(data, {conflict: 'replace'})
			.run(connection, function inserted(err, status) {
				if (err) {
					config.error && config.error('ERR saveData', err);
					return callback && callback(err);

				}
				if (!data.id && status.generated_keys) {
					data.id = status.generated_keys[0];
				}
				config.debug && config.debug('saveData saved', data.id, status);
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

			return r.table(collection).get(data.id).run(connection, function foundOne(err, result) {
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
	function setRethinkContent(data, options, callback) {
		config.debug && config.debug('setRethinkContent options', options);
		//Create the table if needed.
		return r.tableList()
			.contains(options.collection)
			.do(
			function table(containsTable) {
				return r.branch(
					containsTable,
					{created: 0},
					r.tableCreate(options.collection)
				);
			})
			.run(connection, function table_exists(err) {
				if (err) {
					config.error && config.error('ERR2 setRethinkContent', err);
					return callback && callback(err);
				}
				if (options.operation && options.operation.v) {
					data.version = options.operation.v;
				}
				var dumpData = saveData;
				if (options.update) {
					dumpData = updateData;
				}
				if (!data.id) {
					config.debug && config.debug('setRethinkContent lookup by query', options.query, 'updating:', options.update);
					return r.table(options.collection)
						.filter(options.query)
						.run(connection, function filter_table(err, cursor) {

							if (err) {
								config.error && config.error('ERR3 setRethinkContent', err);
								return callback && callback(err);
							}
							return cursor.next(function first_item(err, result) {
								if (err) {
									if (!((err.name === 'RqlDriverError') && (err.message === 'No more rows in the cursor.'))) {
										config.error && config.error('ERR4 getRethinkContent', err);
										return callback && callback(err);
									}
									// ignore when item does not exist yet, that's why we are here to begin with.
								}

								if (result && result.id) {
									data.id = result.id;
								}
								return dumpData(options.collection, data, callback);
							});
						});
				} else {
					return dumpData(options.collection, data, callback);
				}
			});
	}

	return {
		saveData:     saveData,
		updateData:   updateData,
		getAttribute: getRethinkAttribute,
		getContent:   getRethinkContent,
		setContent:   setRethinkContent
	};
};
