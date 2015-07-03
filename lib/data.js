'use strict';
var _ = require('underscore');

module.exports = function (config, dataBase, updateShare) {

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
						return dataBase.setRethinkContent(data, options, function (err, content_result, col) {
							var keys = _.keys(data); // reset all attributes;
							return updateShare.document(documentId, data, keys, function updatedShareDocument() {
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
				attribute_options.query = {};
				attribute_options.query[config.database.pk] = result[options.attribute].guid;

			} else {
				attribute_options.query = {
					parent: result[config.database.pk],
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
					if (attribute_result[config.database.pk] === String(result[options.attribute].guid)) {
						updateContent = false;
					} else {
						result[options.attribute].guid = attribute_result[config.database.pk];
					}
				} else {
					result[options.attribute] = {guid: attribute_result[config.database.pk]};
				}

				attribute_result.parent             = result[config.database.pk];
				attribute_result.name               = result.name + '.' + options.attribute;
				attribute_result[options.attribute] = data;
				if (options.operation) {
					attribute_result.version = options.operation.v;
				}
				return dataBase.saveData(col, attribute_result, function saved(err) {
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
					return updateShare.document(attributeDocumentId, share_data, keys, function updatedShareAttribute() {
						if (updateContent) {
							dataBase.updateData(col, result, function saved(err) {
								if (err) {
									config.error && config.error('ERR3 setMongoAttribute', err);
									return callback && callback(err);
								}
								var path = [options.attribute, 'guid']; // reset just guid attribute;
								return updateShare.documentPath(documentId, result, path, function updatedShareContent() {
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
		getMongoAttribute:   dataBase.getAttribute,
		getMongoContent:     dataBase.getContent,
		setMongoAttribute:   setRethinkAttribute,
		setMongoContent:     dataBase.setContent,

		getAttribute:   dataBase.getAttribute,
		getContent:     dataBase.getContent,
		setAttribute:   setRethinkAttribute,
		setContent:     dataBase.setContent,
		ensureContent:  ensureContent
	};
};
