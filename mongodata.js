var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');


module.exports = function (db, shareModel, config) {

	/*
	 options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 */
	function getMongoContent(options, callback) {
		config.debug && console.log('getMongoContent options', options);
		return db.collection(options.collection, function collection(err, col) {
			if (err) {
				config.errors && console.log('ERR2 getMongoContent', err);
				return callback(err);
			}
			if (!options.query) {
				return callback(new Error('Data not found ' + options.collection + '/ missing query'), null, col);
			}
			if (options.query._id && !(options.query._id instanceof Object)) {
				try {
					options.query._id = new ObjectID.createFromHexString(options.query._id);
				} catch (err) {
					config.errors && console.log('ERR3 getMongoContent', err);
					return callback(err);
				}
			}
			return col.findOne(options.query, function foundOne(err, result) {
				if (err) {
					config.errors && console.log('ERR4 getMongoContent', err);
					return callback(err);
				}
				if (!result) {
					return callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)), null, col);
				}
				return callback(null, result, col);
			});
		});
	}

	var ensuring = false;

	function ensureContent(options, callback) {
		if (ensuring) {
			//noinspection JSUnresolvedFunction
			setImmediate(function rescheduling() {
				config.debug && console.log('Ensuring, rescheduling', options);
				return ensureContent(options, callback);
			});
		} else {
			ensuring = true;
			if (!options.query) {
				options.query = {
					name: options.name
				}
			}
			function stopEnsuring(err, result, col) {
				config.debug && console.log('Stop ensuring', options);
				ensuring = false;
				if (err) {
					return callback(err);
				}
				return callback(null, result, col);
			}

			getMongoContent(options, function document(err, result, col) {
				if (err) {
					if (/Data not found*/.test(err.message)) {
						var documentId = 'json:' + options.collection + ':' + options.name;
						var data = {name: options.name};
						return setMongoContent(data, options, function (err, content_result, col) {
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

	/*
	 options:
	 *	collection (mandatory)
	 *	query (mandatory)
	 *	attribute (mandatory)
	 *	type [json|text] : returns {} or "" when not found.
	 */
	function getMongoAttribute(options, callback) {
		config.debug && console.log('getMongoAttribute options', options);
		return getMongoContent(options, function document(err, result) {
			if (err) {
				config.errors && console.log('ERR1 getMongoAttribute', err);
				return callback(err);
			}
			var attribute_options = null;
			config.debug && console.log('getMongoAttribute result', result);
			if (result
				&& result.hasOwnProperty(options.attribute)
				&& result[options.attribute].guid) {
				attribute_options = {
					collection: options.collection,
					query: {_id: result[options.attribute].guid}
				};
				config.debug && console.log('getMongoAttribute attribute_options', attribute_options);

				return getMongoContent(attribute_options, function attribute(err, attribute_result) {
					if (err) {
						config.errors && console.log('ERR2 getMongoAttribute', err);
						return callback(err);
					}
					config.debug && console.log('getMongoAttribute attribute_result', attribute_result);
					return callback(err, attribute_result);
				});
			} else {
				config.debug && console.log('getMongoAttribute try direct lookup');
				attribute_options = {
					collection: options.collection,
					query: {
						parent: result._id,
						name: result.name + '.' + options.attribute
					}
				};
				config.debug && console.log('getMongoAttribute attribute_options', attribute_options);

				return getMongoContent(attribute_options, function attribute(err, attribute_result) {
					if (err) {
						config.errors && console.log('ERR3 getMongoAttribute', err);
						return callback(err);
					}
					if (attribute_result) {
						config.debug && console.log('getMongoAttribute direct attribute_result', attribute_result);
						return callback(err, attribute_result);
					} else {
						if (options.type) {
							if (options.type == 'json') {
								config.errors && console.log('ERR4 getMongoAttribute empty json {}');

								return callback(null, '{}');
							}
							if (options.type == 'text') {
								config.errors && console.log('ERR5 getMongoAttribute empty string');
								return callback(null, '');
							}
						}
						return callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query) + '.' + options.attribute));
					}
				});

			}
		})
	}

	function saveData(collection, data, callback) {
		if (data._id && !(data._id instanceof Object)) {
			data._id = new ObjectID.createFromHexString(data._id);
		}
		config.debug && console.log('saveData saving', data._id);
		collection.save(data, {safe: true}, function (err, result2, result3) {
			if (err) {
				config.errors && console.log('ERR saveData', err);
				return callback(err);

			}
			config.debug && console.log('saveData saved', data._id, result2, result3);
			return callback(null, data, collection);
		});
	}

	function setMongoContent(data, options, callback) {
		config.debug && console.log('setMongoContent options', options);
		return db.collection(options.collection, function collection(err, col) {
			if (err) {
				config.errors && console.log('ERR2 setMongoContent', err);
				return callback(err);
			}
			if (options.operation) {
				data.version = options.operation.v;
			}
			if (!data._id) {
				config.debug && console.log('setMongoContent lookup by query', options.query);
				return col.findOne(options.query, function foundOne(err, result) {
					if (err) {
						config.errors && console.log('ERR3 setMongoContent', err);
						return callback(err);
					}
					if (result) {
						data._id = result._id;
					}
					return saveData(col, data, callback);
				})
			} else {
				return saveData(col, data, callback);
			}
		});
	}

	function setMongoAttribute(data, options, callback) {
		config.debug && console.log('setMongoAttribute options', options);
		ensureContent(options, function document(err, result, col) {
			if (err) {
				config.errors && console.log('ERR1 setMongoAttribute', err);
				return callback(err);
			}
			var attribute_options = {
				collection: options.collection,
				name: result.name + '.' + options.attribute
			};
			if (result.hasOwnProperty(options.attribute)
				&& result[options.attribute].guid) {
				attribute_options.query = {
					_id: result[options.attribute].guid
				};
			} else {
				attribute_options.query = {
					parent: result._id,
					name: result.name + '.' + options.attribute
				}

			}

			config.debug && console.log('getMongoAttribute parent found, get child and save', result, attribute_options);
			return ensureContent(attribute_options, function attribute(err, attribute_result) {
				if (err) {
					config.errors && console.log('ERR2 setMongoAttribute ensureContent', err);
					return callback(err);
				}
				if (result[options.attribute]) {
					result[options.attribute].guid = attribute_result._id;
				} else {
					result[options.attribute] = { guid: attribute_result._id };
				}

				attribute_result.parent = result._id;
				attribute_result.name = result.name + '.' + options.attribute;
				attribute_result[options.attribute] = data;
				if (options.operation) {
					attribute_result.version = options.operation.v;
				}
				var documentId = 'json:' + options.collection + ':' + result.name;
				var attributeDocumentId = documentId + ':' + options.attribute;
				return saveData(col, attribute_result, function saved(err) {
					if (err) {
						config.errors && console.log('ERR3 setMongoAttribute', err);
						return callback(err);
					}
					var keys = _.keys(attribute_result); // reset all attributes;
					return updateShareDocument(attributeDocumentId, attribute_result, keys, function updatedShareAttribute() {
						return saveData(col, result, function saved(err) {
							if (err) {
								config.errors && console.log('ERR3 setMongoAttribute', err);
								return callback(err);
							}
							var path = [options.attribute, 'guid']; // reset just guid attribute;
							return updateShareDocumentPath(documentId, result, path, function updatedShareContent() {
								return callback(null, attribute_result, col);
							});
						});
					});
				});
			});
		});
	}

	function updateShareDocument(documentId, data, keys, callback) {
		var ops = [];
		return shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.errors && console.log('WARN createShareDocument shareModel.getSnapshot', documentId, err);
				return callback && callback();
			} else {
				_.forEach(keys, function (key) {
					if (key != '_id') {
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
				return shareModel.applyOp(documentId, { op: ops, v: doc.v }, function (err, result) {
					if (err) {
						config.errors && console.log('ERR setMongoAttribute createShareDocument shareModel.applyOp', documentId, err);
						return callback && callback();
					}
					config.debug && console.log('createShareDocument shareModel.applyOp', documentId, ops, err, result);
					return callback && callback();
				});
			}
		});
	}

	function updateShareDocumentPath(documentId, data, path, callback) {
		shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.errors && console.log('WARN setMongoAttribute updateShareDocumentPath shareModel.getSnapshot', documentId, err);
				return callback && callback();
			} else {
				var sub_data = data;
				var sub_snapshot_data = doc.snapshot;
				var equal_path = [];
				var found = false;
				for (var x = 0; !found && x < path.length; x++) {
					var key = path[x];
					if (sub_data && sub_data.hasOwnProperty(key) &&
						sub_snapshot_data && sub_snapshot_data.hasOwnProperty(key)) {
						sub_data = sub_data[key];
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
				return shareModel.applyOp(documentId, { op: [op], v: doc.v }, function (err, result) {
					if (err) {
						config.errors && console.log('ERR updateShareDocumentPath shareModel.applyOp', documentId, err);
						return callback && callback();
					}
					config.debug && console.log('updateShareDocumentPath shareModel.applyOp', documentId, op, err, result);
					return callback && callback();

				});
			}
		});
	}

	return {
		getMongoAttribute: getMongoAttribute,
		getMongoContent: getMongoContent,
		setMongoAttribute: setMongoAttribute,
		setMongoContent: setMongoContent,
		ensureContent: ensureContent,
		updateShareDocument: updateShareDocument
	};
};




