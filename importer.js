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
			),
			function onSuccess(leftover) {
				handleImportMarkers(doc, options, function handleLeftover(err, remainder) {
					if (err) {
						config.errors && console.log('ERR importer.importer handleImportMarkers', err);
						return cb(err);
					}
					if (leftover) {
						mongoInstance.ensureContent(leftover.replacement, function parent(err, parent_result) {
							if (err) {
								config.errors && console.log('ERR importer.importer ensureContent', err);
								return cb(err);
							}
							leftover.replacement.query = { _id: parent_result._id };

							remainder = remainder.replace(leftover.regExp, "");
							mongoInstance.setMongoAttribute(remainder, leftover.replacement, function (err, attribute_result) {
								return cb(err, remainder);
							})
						})
					} else {
						console.log('no import_leftover tag found');
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
		/* markers:
		 import__[collection]_[name]_[attribute]_
		 _end_import__[collection]_[name]_[attribute]

		 moves content between tags into /collection/name/attribute


		 import_file__[filename]__into__[collection]_[name]_[attribute]

		 read filename into /collection/name/attribute and process it.
		 */
		var import_tag = 'import__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([\\w\\W]*)_end_import__\\1_\\2_\\3';
		var import_regexp = new RegExp(helpers.marker_prefix + import_tag + helpers.marker_postfix);
		var import_strip_regexp = new RegExp(helpers.marker_postfix + '([\\w\\W]*)' + helpers.marker_prefix);

		promises.push(
			helpers.replace(doc, import_tag, function (result, callback) {
				var parts = import_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				var striped_parts = import_strip_regexp.exec(parts[4]);
				var sub_doc = striped_parts[1];

				handleImportMarkers(sub_doc, options, function handleLeftover(err, remainder) {
					mongoInstance.ensureContent(context, function parent(err, parent_result) {
						if (err) {
							config.errors && console.log('ERR importer.replaceMarkers ensureContent', err);
							return callback(err);
						}
						context.query = { _id: parent_result._id };

						mongoInstance.setMongoAttribute(remainder, context, function (err, attribute_result) {
							var replacement = {
								regExp: result,
								value: ""
							};
							return callback(err, replacement);
						});
					})

				});
			})
		);

		var import_file_tag = 'import_file__([A-Za-z0-9.]+)__into__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var import_file_regexp = new RegExp(helpers.marker_prefix + import_file_tag + helpers.marker_postfix);

		promises.push(
			helpers.replace(doc, import_file_tag, function (result, callback) {
				var parts = import_file_regexp.exec(result);
				var filename = path.resolve(config.public_path, parts[1]);
				var context = {
					collection: parts[2],
					name: parts[3],
					attribute: parts[4]
				};
				fs.readFile(filename, 'utf-8', function (err, sub_doc) {
					if (err) {
						config.errors && console.log('ERR importer.replaceMarkers readFile', err);
						return callback(err);
					}
					// process with leftover marker support
					importer(sub_doc, context, function handleLeftover(err, remainder) {
						if (err) {
							config.errors && console.log('ERR importer.replaceMarkers importer', err);
							return callback(err);
						}
						mongoInstance.ensureContent(context, function parent(err, parent_result) {
							if (err) {
								config.errors && console.log('ERR importer.importer ensureContent', err);
								return callback(err);
							}
							context.query = { _id: parent_result._id };

							mongoInstance.setMongoAttribute(remainder, context, function (err, attribute_result) {
								// remove import_file marker from source
								var replacement = {
									regExp: result,
									value: ""
								};
								return callback(err, replacement);
							});
						});
					});
				});
			})
		);

		return promises;
	};

	return {
		importer: importer
	}
};
