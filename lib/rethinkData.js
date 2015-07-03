'use strict';
var _ = require('underscore');

module.exports = function (config, r, connection, shareModel) {
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

	function updateShareDocumentPath(documentId, data, path, callback) {
		shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.warn && config.warn('WARN updateShareDocumentPath shareModel.getSnapshot', documentId, err);
				return callback && callback();
			}
			var sub_data          = data;
			var sub_snapshot_data = doc.snapshot;
			var equal_path        = [];
			var found             = false;
			var x;
			for (x = 0; !found && x < path.length; x += 1) {
				var key = path[x];
				if (sub_data && sub_data.hasOwnProperty(key) &&
					sub_snapshot_data &&
					sub_snapshot_data.hasOwnProperty(key)) {
					sub_data          = sub_data[key];
					sub_snapshot_data = sub_snapshot_data[key];
					equal_path.push(key);
				} else if (!sub_snapshot_data || !sub_snapshot_data.hasOwnProperty(key)) {
					found = true;
				}
			}
			if (found) {
				path = equal_path;
			}
			var op = {
				p: path
			};
			if (sub_data) {
				op.oi = sub_data;
			}
			if (sub_snapshot_data) {
				op.od = sub_snapshot_data;
			}
			return shareModel.applyOp(documentId, {
				op: [op],
				v:  doc.v
			}, function (err, result) {
				if (err) {
					config.error && config.error('ERR updateShareDocumentPath shareModel.applyOp', documentId, err);
					return callback && callback();
				}
				config.debug && config.debug('updateShareDocumentPath shareModel.applyOp', documentId, op, err, result);
				return callback && callback();

			});
		});
	}

	function updateShareDocument(documentId, data, keys, callback) {
		if (!keys) {
			// no keys no update
			return callback && callback();
		}
		var ops = [];
		return shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.warn && config.warn('WARN updateShareDocument shareModel.getSnapshot', documentId, err);
				return callback && callback();
			}
			if (doc.type.name === 'text') {
				ops.push({
					d: doc.snapshot,
					p: 0
				});
				ops.push({
					i: data,
					p: 0
				});
			} else if (doc.type.name === 'json') {
				_.forEach(keys, function (key) {
					if (key !== 'id') {
						var op = {
							p: [key]
						};
						if (doc.snapshot[key]) {
							op.od = doc.snapshot[key];
						}
						if (data[key]) {
							op.oi = data[key];
						}
						ops.push(op);
					}
				});
			}
			return shareModel.applyOp(documentId, {
				op: ops,
				v:  doc.v
			}, function (err, result) {
				if (err) {
					config.warn && config.warn('WARN updateShareDocument shareModel.applyOp', documentId, err);
					return callback && callback();
				}
				config.debug && config.debug('updateShareDocument shareModel.applyOp', documentId, ops, err, result);
				return callback && callback();
			});
		});
	}


	var ensuring = false;

	function ensureContent(options, callback) {
		if (ensuring) {
			//noinspection JSUnresolvedFunction
			setImmediate(function rescheduling() {
				config.debug && config.debug('Ensuring, rescheduling', options);
				return ensureContent(options, callback);
			});
		} else {
			ensuring = true;
			if (!options.query) {
				options.query = {
					name: options.name
				};
			}
			var stopEnsuring = function (err, result, col) {
				config.debug && config.debug('Stop ensuring', options);
				ensuring = false;
				if (err) {
					return callback && callback(err);
				}
				return callback && callback(null, result, col);
			};

			return getRethinkContent(options, function document(err, result, col) {
				if (err) {
					if (/Data not found*/.test(err.message)) {
						var documentId = 'json:' + options.collection + ':' + options.name;
						var data       = {name: options.name};
						return setRethinkContent(data, options, function (err, content_result, col) {
							var keys = _.keys(data); // reset all attributes;
							return updateShareDocument(documentId, data, keys, function updatedShareDocument() {
								stopEnsuring(err, content_result, col);
							});
						});
					} else {
						return stopEnsuring(err);
					}
				} else {
					return stopEnsuring(null, result, col);
				}
			});
		}
	}


	/* options:
	 * no_share (optional): prevent share from updating itself.
	 */
	function setRethinkAttribute(data, options, callback) {
		config.debug && config.debug('setMongoAttribute options', options);
		return ensureContent(options, function document(err, result, col) {
			if (err) {
				config.error && config.error('ERR1 setMongoAttribute', err);
				return callback && callback(err);
			}
			var attribute_options = {
				collection: options.collection,
				name:       result.name + '.' + options.attribute
			};
			if (result.hasOwnProperty(options.attribute) &&
				result[options.attribute].guid) {
				attribute_options.query = {
					id: result[options.attribute].guid
				};
			} else {
				attribute_options.query = {
					parent: result.id,
					name:   result.name + '.' + options.attribute
				};

			}

			config.debug && config.debug('getMongoAttribute parent found, get child and save', result, attribute_options);
			return ensureContent(attribute_options, function attribute(err, attribute_result) {
				if (err) {
					config.error && config.error('ERR2 setMongoAttribute ensureContent', err);
					return callback && callback(err);
				}
				var updateContent = true;
				if (result[options.attribute]) {
					if (attribute_result.id === String(result[options.attribute].guid)) {
						updateContent = false;
					} else {
						result[options.attribute].guid = attribute_result.id;
					}
				} else {
					result[options.attribute] = {guid: attribute_result.id};
				}

				attribute_result.parent             = result.id;
				attribute_result.name               = result.name + '.' + options.attribute;
				attribute_result[options.attribute] = data;
				if (options.operation) {
					attribute_result.version = options.operation.v;
				}
				return saveData(col, attribute_result, function saved(err) {
					if (err) {
						config.error && config.error('ERR3 setMongoAttribute', err);
						return callback && callback(err);
					}
					var documentId          = 'json:' + options.collection + ':' + result.name;
					var type                = options.type || 'text';
					var attributeDocumentId = type + ':' + options.collection + ':' + result.name + ':' + options.attribute;
					var keys                = null;
					var share_data          = null;
					if (type === 'json') {
						keys = _.keys(attribute_result); // reset all attributes;
						share_data = attribute_result;
					} else {
						keys       = [attribute_result.name];
						share_data = data;
					}
					if (options.no_share) {
						keys = null;
					}
					return updateShareDocument(attributeDocumentId, share_data, keys, function updatedShareAttribute() {
						if (updateContent) {
							updateData(col, result, function saved(err) {
								if (err) {
									config.error && config.error('ERR3 setMongoAttribute', err);
									return callback && callback(err);
								}
								var path = [options.attribute, 'guid']; // reset just guid attribute;
								return updateShareDocumentPath(documentId, result, path, function updatedShareContent() {
									return callback && callback(null, attribute_result, col);
								});
							});
						} else {
							return callback && callback(null, attribute_result, col);
						}
					});
				});
			});
		});
	}

	return {
		getMongoAttribute:   getRethinkAttribute,
		getMongoContent:     getRethinkContent,
		setMongoAttribute:   setRethinkAttribute,
		setMongoContent:     setRethinkContent,
		ensureContent:       ensureContent,
		updateShareDocument: updateShareDocument
	};
};
