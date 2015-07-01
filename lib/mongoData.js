'use strict';
var ObjectID = require('mongodb').ObjectID;
var _        = require('underscore');


module.exports = function (config, db, shareModel) {
	/*
	 *  options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 */
	function getMongoContent(options, callback) {
		config.debug && config.debug('getMongoContent options', options);
		if (!options.collection) {
			return callback(new Error('Data not found / missing collection'));
		}
		return db.collection(options.collection, function collection(err, col) {
			if (err) {
				config.error && config.error('ERR2 getMongoContent', err);
				return callback && callback(err);
			}
			if (!options.query) {
				return callback && callback(new Error('Data not found ' + options.collection + '/ missing query'), null, col);
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
		return getMongoContent(options, function document(err, result) {
			if (err) {
				config.error && config.error('ERR1 getMongoAttribute', err);
				return callback && callback(err);
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

				getMongoContent(attribute_options, function attribute(err, attribute_result) {
					if (err) {
						config.error && config.error('ERR2 getMongoAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getMongoAttribute attribute_result', attribute_result);
					return callback && callback(err, attribute_result);
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

				return getMongoContent(attribute_options, function attribute(err, attribute_result) {
					if (err) {
						config.error && config.error('ERR getMongoAttribute', err);
						return callback && callback(err);
					}
					config.debug && config.debug('getMongoAttribute direct attribute_result', attribute_result);
					return callback && callback(err, attribute_result);
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
	 * update (optional) : extends existing content
	 */
	function setMongoContent(data, options, callback) {
		config.debug && config.debug('setMongoContent options', options);
		return db.collection(options.collection, function handleCollection(err, collection) {
			if (err) {
				config.error && config.error('ERR2 setMongoContent', err);
				return callback && callback(err);
			}
			if (options.operation) {
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
					if (result) {
						data._id = result._id;
					}
					return dumpData(collection, data, callback);
				});
			} else {
				return dumpData(collection, data, callback);
			}
		});
	}

	function updateShareDocumentPath(documentId, data, path, callback) {
		shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.warn && config.warn('WARN setMongoAttribute updateShareDocumentPath shareModel.getSnapshot', documentId, err);
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
					if (key !== '_id') {
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

			getMongoContent(options, function document(err, result, col) {
				if (err) {
					if (/Data not found*/.test(err.message)) {
						var documentId = 'json:' + options.collection + ':' + options.name;
						var data       = {name: options.name};
						setMongoContent(data, options, function (err, content_result, col) {
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
	 * no_share (optional): prevent share to update itself.
	 */
	function setMongoAttribute(data, options, callback) {
		config.debug && config.debug('setMongoAttribute options', options);
		ensureContent(options, function document(err, result, col) {
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
					_id: result[options.attribute].guid
				};
			} else {
				attribute_options.query = {
					parent: result._id,
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
					if (attribute_result._id.toString() === String(result[options.attribute].guid)) {
						updateContent = false;
					} else {
						result[options.attribute].guid = attribute_result._id;
					}
				} else {
					result[options.attribute] = {guid: attribute_result._id};
				}

				attribute_result.parent             = result._id;
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
		getMongoAttribute:   getMongoAttribute,
		getMongoContent:     getMongoContent,
		setMongoAttribute:   setMongoAttribute,
		setMongoContent:     setMongoContent,
		ensureContent:       ensureContent,
		updateShareDocument: updateShareDocument
	};
};
