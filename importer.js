var when = require('when');
var _ = require('underscore');
var helpers = require('./helpers.js');
var path = require('path');
var fs = require('fs');


module.exports = function (config, mongoInstance) {

	var import_leftovers_tag = 'import_leftovers__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var import_leftovers_regexp = new RegExp(helpers.marker_prefix + import_leftovers_tag + helpers.marker_postfix);

	var importer = function (doc, options, cb) {
		when.any(
			helpers.replace(doc, import_leftovers_tag, function getReplacement(result, callback) {
					var parts = import_leftovers_regexp.exec(result);
					var context = {
						collection: parts[1],
						name: parts[2],
						attribute: parts[3]
					};
					return callback(null, {
						regExp: new RegExp(result, 'gmi'),
						value: context
					});
				},
				// there can be only one import_leftovers
				true
			)
			).then(
			function onSuccess(leftover) {
				handleImportMarkers(doc, options, function handleLeftover(err, remainder) {
					if (err) {
						config.errors && console.log('ERR importer.importer handleImportMarkers', err);
						return cb(err);
					}
					if (leftover) {
						return mongoInstance.ensureContent(leftover.replacement, function parent(err, parent_result) {
							if (err) {
								config.errors && console.log('ERR importer.importer ensureContent', err);
								return cb(err);
							}
							leftover.replacement.query = { _id: parent_result._id };

							remainder = remainder.replace(leftover.regExp, "");
							return mongoInstance.setMongoAttribute(remainder, leftover.replacement, function savedAttribute(err) {
								if (err) {
									config.errors && console.log('ERR importer.importer setMongoAttribute', err);
									return cb(err);
								}
								return cb(null, remainder);
							})
						})
					} else {
						config.debug && console.log('no import_leftover tag found');
						return cb(null, remainder);
					}
				});
			},
			function onFailure(err) {
				config.errors && console.log('ERR importer.importer onFailure', err);
				return cb(err);
			}
		)
	};

	var handleImportMarkers = function (doc, options, callback) {
		var promises = replaceMarkers(doc, options);

		function handler(text, result) {
			var new_text = text.replace(result.regExp, result.replacement);
			config.debug && console.log('handleImportMarker.handler new_text', new_text);
			return new_text;
		}

		helpers.handTextManipulation(doc,
			promises,
			handler,
			callback
		);
	};

	var replaceMarkers = function (doc, options) {
		var promises = [];
		var import_tag = 'import__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([\\w\\W]*)_end_import__\\1_\\2_\\3';
		var import_regexp = new RegExp(helpers.marker_prefix + import_tag + helpers.marker_postfix);
		var import_strip_regexp = new RegExp(helpers.marker_postfix + '([\\w\\W]*)' + helpers.marker_prefix);

		promises.push(
			helpers.replace(doc, import_tag, function handleImportMarker(result, callback) {
				var parts = import_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				var striped_parts = import_strip_regexp.exec(parts[4]);
				var sub_doc = striped_parts[1];

				handleImportMarkers(sub_doc, options, function handleLeftover(err, remainder) {
					if (err) {
						config.errors && console.log('ERR importer.replaceMarkers import_content_marker', err);
						return callback(err);
					}
					return importRemainder(context, result, remainder, callback);
				});
			})
		);

		var import_file_tag = 'import_file__([A-Za-z0-9.\/]+)__into__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var import_file_regexp = new RegExp(helpers.marker_prefix + import_file_tag + helpers.marker_postfix);

		promises.push(
			helpers.replace(doc, import_file_tag, function handleImportFileMarker(result, callback) {
				var parts = import_file_regexp.exec(result);
				var filename = path.resolve(config.statics.importer_path, parts[1]);
				var context = {
					collection: parts[2],
					name: parts[3],
					attribute: parts[4]
				};
				fs.readFile(filename, 'utf-8', function handleFileContent(err, sub_doc) {
					if (err) {
						config.errors && console.log('ERR importer.replaceMarkers readFile', err);
						return callback(err);
					}
					// process with leftover marker support
					return importer(sub_doc, context, function handleLeftover(err, remainder) {
						if (err) {
							config.errors && console.log('ERR importer.replaceMarkers importer', err);
							return callback(err);
						}
						return importRemainder(context, result, remainder, callback);
					});
				});
			})
		);

		return promises;
	};

	function importRemainder( context, result, remainder, callback) {
		return mongoInstance.ensureContent(context, function parent(err, parent_result) {
			if (err) {
				config.errors && console.log('ERR importer.importer ensureContent', err);
				return callback(err);
			}
			function replaceWithEmptyContent(err) {
				var replacement = {
					regExp: result,
					value: ""
				};
				return callback(err, replacement);
			}

			if (context.attribute == "json") {
				var data = null;
				try {
					data = JSON.parse(remainder);
				} catch (err) {
					config.errors && console.log('ERR importer.replaceMarkers JSON.parse(remainder)', remainder, err);
					return callback(err);
				}
				if (data._id) {
					delete data._id;
				}
				_.extend(parent_result, data);
				context.update = true;
				return mongoInstance.setMongoContent(parent_result, context, function (err) {
					if (err) {
						config.errors && console.log('ERR importer.importRemainder setMongoContent', err);
						return callback(err);
					}
					var documentId = 'json:' + context.collection + ':' + context.name;
					var keys = _.keys(parent_result); // reset all attributes;
					return mongoInstance.updateShareDocument(documentId, parent_result, keys, function () {
						return replaceWithEmptyContent(null);
					});
				});
			} else {
				context.query = { _id: parent_result._id };
				return mongoInstance.setMongoAttribute(remainder, context, function savedAttribute(err) {
					if (err) {
						config.errors && console.log('ERR2 importer.importer setMongoAttribute', err);
						return callback(err);
					}
					return replaceWithEmptyContent(null);
				});
			}
		});
	}

	return {
		importer: importer
	}
};
