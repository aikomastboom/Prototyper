var ObjectID = require('mongodb').ObjectID;


module.exports = function (db, config) {

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
				return callback(new Error('Data not found ' + options.collection + '/ missing query'));
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
					return callback(new Error('Data not found ' + options.collection + '/' + JSON.stringify(options.query)));
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
			function stopEnsuring(err, result) {
				config.debug && console.log('Stop ensuring', options);
				ensuring = false;
				if (err) {
					return callback(err);
				}
				return callback(null, result);
			}

			getMongoContent(options, function document(err, result) {
				if (err) {
					if (/Data not found*/.test(err.message)) {
						return setMongoContent({name: options.name}, options,
							stopEnsuring
						)
					} else {
						return stopEnsuring(err);
					}
				} else {
					return stopEnsuring(null, result);
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
		config.debug && console.log('saving', data._id);
		collection.save(data, {safe: true}, callback);
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
		getMongoContent(options, function document(err, result, col) {
			if (err) {
				config.errors && console.log('ERR1 setMongoAttribute', err);
				return callback(err);
			}
			var attribute_options = {
				collection: options.collection
			};
			if (result.hasOwnProperty(options.attribute)
				&& result[options.attribute].guid) {
				config.debug && console.log('getMongoAttribute parent found, get child and save');
				attribute_options.query = {_id: result[options.attribute].guid};
				return getMongoContent(attribute_options, function attribute(err, attribute_result, col) {
					if (err) {
						config.errors && console.log('ERR2 setMongoAttribute', err);
						return callback(err);
					}
					attribute_result[options.attribute] = data;
					if (options.operation) {
						attribute_result.version = options.operation.v;
					}
					attribute_result.parent = result._id;
					return saveData(col, attribute_result, callback);
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
					if (attribute_result) {
						config.debug && console.log('getMongoAttribute found lost attribute, reconnect');
						if (result[options.attribute]) {
							result[options.attribute].guid = attribute_result._id;
						} else {
							result[options.attribute] = { guid: attribute_result._id };
						}
						return saveData(col, result, callback);

					} else {
						config.debug && console.log('getMongoAttribute field does not exist yet. need to create doc first.');
						var attribute_data = {
							name: result.name + '.' + options.attribute,
							parent: result._id
						};
						attribute_data[options.attribute] = data;
						if (options.operation) {
							attribute_data.version = options.operation.v;
						}

						return saveData(col, attribute_data, function saved(err, attribute_result) {
							if (err) {
								config.errors && console.log('ERR3 setMongoAttribute', err);
							}
							result[options.attribute] = { guid: attribute_result._id };
							return saveData(col, result, callback);
						})
					}
				});
			}
		})
	}

	return {
		getMongoAttribute: getMongoAttribute,
		getMongoContent: getMongoContent,
		setMongoAttribute: setMongoAttribute,
		setMongoContent: setMongoContent,
		ensureContent: ensureContent
	};
};




