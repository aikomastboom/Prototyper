'use strict';
var when = require('when');
var _    = require('underscore');
var path = require('path');
var fs   = require('fs');


module.exports = function (config, mongoInstance, helpers, markers) {
	var replaceMarkers;

	function handleImportMarkers(doc, options, callback) {
		var promises = replaceMarkers(doc, options);

		function handler(text, result) {
			var new_text = text.replace(result.regExp, result.replacement);
			config.debug && config.debug('handleImportMarker.handler new_text', new_text);
			return new_text;
		}

		return helpers.handTextManipulation(doc,
			promises,
			handler,
			callback
		);
	}

	var import_leftovers_tag    = markers.import_leftovers_tag;
	var import_leftovers_regexp = markers.import_leftovers_regexp;

	function importer(doc, options, cb) {
		var promises = helpers.replace(doc, import_leftovers_tag,
			function getReplacement(result, callback) {
				var parts   = import_leftovers_regexp.exec(result);
				var context = {
					collection: parts[1],
					name:       parts[2],
					attribute:  parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value:  context
				});
			},
			// there can be only one import_leftovers
			true
		);
		when.any(promises).then(
			function onSuccess(leftover) {
				handleImportMarkers(doc, options, function handleLeftover(err, remainder) {
					if (err) {
						config.error && config.error('ERR importer.importer handleImportMarkers', err);
						return cb && cb(err);
					}
					if (leftover) {
						return mongoInstance.ensureContent(leftover.replacement, function parent(err, parent_result) {
							if (err) {
								config.error && config.error('ERR importer.importer ensureContent', err);
								return cb && cb(err);
							}
							leftover.replacement.query = {_id: parent_result._id};

							remainder = remainder.replace(leftover.regExp, '');
							return mongoInstance.setMongoAttribute(remainder, leftover.replacement, function savedAttribute(err) {
								if (err) {
									config.error && config.error('ERR importer.importer setMongoAttribute', err);
									return cb && cb(err);
								}
								return cb && cb(null, remainder);
							});
						});
					}
					config.debug && config.debug('no import_leftover tag found');
					return cb && cb(null, remainder);
				});
			},
			function onFailure(err) {
				config.error && config.error('ERR importer.importer onFailure', err);
				return cb && cb(err);
			}
		);
	}


	function importRemainder(context, result, remainder, callback) {
		return mongoInstance.ensureContent(context, function parent(err, parent_result) {
			if (err) {
				config.error && config.error('ERR importer.importer ensureContent', err);
				return callback && callback(err);
			}
			function replaceWithEmptyContent(err) {
				var replacement = {
					regExp: result,
					value:  ''
				};
				return callback && callback(err, replacement);
			}

			if (context.attribute === 'json') {
				var data       = null;
				try {
					data = JSON.parse(remainder);
				} catch (error) {
					config.error && config.error('ERR importer.replaceMarkers JSON.parse(remainder)', remainder, error);
					return callback && callback(error);
				}
				if (data._id) {
					delete data._id;
				}
				_.extend(parent_result, data);
				context.update = true;
				return mongoInstance.setMongoContent(parent_result, context, function (err) {
					if (err) {
						config.error && config.error('ERR importer.importRemainder setMongoContent', err);
						return callback && callback(err);
					}
					var documentId = 'json:' + context.collection + ':' + context.name;
					var keys       = _.keys(parent_result); // reset all attributes;
					return mongoInstance.updateShareDocument(documentId, parent_result, keys, function () {
						return replaceWithEmptyContent(null);
					});
				});
			}
			context.query = {_id: parent_result._id};
			return mongoInstance.setMongoAttribute(remainder, context, function savedAttribute(err) {
				if (err) {
					config.error && config.error('ERR2 importer.importer setMongoAttribute', err);
					return callback && callback(err);
				}
				return replaceWithEmptyContent(null);
			});
		});
	}

	var import_tag          = markers.import_tag;
	var import_regexp       = markers.import_regexp;
	var import_strip_regexp = markers.import_strip_regexp;

	var import_file_tag    = markers.import_file_tag;
	var import_file_regexp = markers.import_file_regexp;

	replaceMarkers = function (doc, options) {
		var promises = [];

		promises.push(
			helpers.replace(doc, import_tag, function handleImportMarker(result, callback) {
				var parts         = import_regexp.exec(result);
				var context       = {
					collection: parts[1],
					name:       parts[2],
					attribute:  parts[3]
				};
				var striped_parts = import_strip_regexp.exec(parts[4]);
				var sub_doc       = striped_parts[1];

				handleImportMarkers(sub_doc, options, function handleLeftover(err, remainder) {
					if (err) {
						config.error && config.error('ERR importer.replaceMarkers import_content_marker', err);
						return callback && callback(err);
					}
					return importRemainder(context, result, remainder, callback);
				});
			})
		);


		promises.push(
			helpers.replace(doc, import_file_tag, function handleImportFileMarker(result, callback) {
				var parts    = import_file_regexp.exec(result);
				var filename = path.resolve(config.statics.importer_path, parts[1]);
				var context  = {
					collection: parts[2],
					name:       parts[3],
					attribute:  parts[4]
				};
				fs.readFile(filename, 'utf-8', function handleFileContent(err, sub_doc) {
					if (err) {
						config.error && config.error('ERR importer.replaceMarkers readFile', err);
						return callback && callback(err);
					}
					// process with leftover marker support
					return importer(sub_doc, context, function handleLeftover(err, remainder) {
						if (err) {
							config.error && config.error('ERR importer.replaceMarkers importer', err);
							return callback && callback(err);
						}
						return importRemainder(context, result, remainder, callback);
					});
				});
			})
		);

		return promises;
	};


	return {
		importer: importer
	};
};
