var when = require('when');
var _ = require('underscore');
var helpers = require('./helpers.js');
var fs = require('fs');


module.exports = function (config, mongoInstance) {

	var import_leftovers_tag = 'import_leftovers__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var import_leftovers_regexp = new RegExp(import_leftovers_tag);

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
					if (leftover) {
						remainder = remainder.replace(leftover.regExp, "");
						mongoInstance.setMongoAttribute(remainder, leftover.value, function (err,result) {
							return cb(err);
						})
					} else {
						return cb(err);
					}

				});
			},
			function onFailure(err) {
				return cb(err);
			}
		)
	};

	var handleImportMarkers = function (doc, options, callback) {
		var promises = replaceMarkers(doc, options);
		function handler( text, result) {
			return text.replace(result.regExp, result.replacement);
		}
		helpers.handTextManipulation(doc,
			promises,
			handler,
			callback
		);
	};

	var replaceMarkers = function(doc, options) {
		var promises = [];
		/* markers:
		 	import__[collection]_[name]_[attribute]
		 	end_import__[collection]_[name]_[attribute]

		 	moves content between tags into /collection/name/attribute


		 	import_file__[filename]__into__[collection]_[name]_[attribute]

			read filename into /collection/name/attribute and process it.
		 */
		var import_tag = 'import__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)([\\w\\W]*)_end_import_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var import_regexp = new RegExp(import_tag);

		promises.push(
			helpers.replace(doc, import_tag, function (result, callback) {
				var parts = import_regexp.exec(result);
				if (parts[1] != parts[5]
					|| parts[2] != parts[6]
					|| parts[3] != parts[7]
					) {
					callback(new Error('no closing tag found for import__'+parts[1]+'_'+parts[2]+'_'+parts[3]))
				}
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				var sub_doc = parts[4];
				handleImportMarkers(sub_doc, options, function handleLeftover(err, remainder) {
					mongoInstance.setMongoAttribute(remainder, context, function (err,attribute_result) {
						return callback(err, {
							regExp: new RegExp(result, 'gmi'),
							value: ""
						});
					});

				});
			})
		);

		var import_file_tag = 'import_file__(\\w\\W)__into__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var import_file_regexp = new RegExp(import_file_tag);

		promises.push(
			helpers.replace(doc, import_file_tag, function (result, callback) {
				var parts = import_file_regexp.exec(result);
				var filename = parts[0];
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				var sub_doc = fs.readFile(filename, 'utf-8');
				// process with leftover marker support
				importer(sub_doc, context, function handleLeftover(err, attribute_result) {
					// remove import_file marker from source
					return callback(err, {
						regExp: new RegExp(result, 'gmi'),
						value: ""
					});
				});
			})
		);
	};

	return {
		importer: importer
	}
};
