var ShareJS = require('share');
var mongoData = require('./mongodata.js');
var responder = require('./responder.js');
var preview = require('./preview.js');
var importer = require('./importer.js');

var path = require('path');
var fs = require('fs');

module.exports = function (app, db, config) {

	// share wraps express app with http.Server
	if (config
		&& config.share
		&& config.share.db
		&& config.share.db.type == 'mongo') {
		config.share.db.client = db;
	}
	var server = ShareJS.server.attach(app, config.share);
	var model = app.model;

	var mongoDataInstance = mongoData(db, model, config);
	var route;
	route = config.api.data + '/:collection/:guid/:attribute.:ext(css|less|js|html)';
	app.get(route,
		function getMongoAttribute(req, res, next) {
			config.debug && console.log('/data/:collection/:guid/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			mongoDataInstance.getMongoAttribute(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.data + '/:collection/:guid.:ext(json)';
	app.get(route,
		function getMongoContent(req, res, next) {
			config.debug && console.log('/data/:collection/:guid.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			mongoDataInstance.getMongoContent(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.content + '/:collection/:name/:attribute.:ext(css|less|js|html)';
	app.get(route,
		function getMongoAttribute(req, res, next) {
			config.debug && console.log('/content/:collection/:name/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			mongoDataInstance.getMongoAttribute(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.content + '/content/:collection/:name.:ext(json)';
	app.get(route,
		function getMongoContent(req, res, next) {
			config.debug && console.log('/content/:collection/:name.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			mongoDataInstance.getMongoContent(options,
				responder(options, res, next)
			);
		}
	);

	function handleMongoGetResult(options) {
		function handleResult(err, result) {
			var notFound = false;
			if (err) {
				if (/Data not found*/.test(err.message)) {
					config.debug && console.log('handleMongoGetResult.handleResult Document/Attribute not found, It will be created on first OT');
					result = {};
					if (options.attribute) {
						if (options.type == 'json') {
							result[options.attribute] = {};
						} else {
							result[options.attribute] = "";
						}
					}
					notFound = true;
				} else {
					config.errors && console.log('ERR1 handleMongoGetResult.handleResult Error retrieving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				}
			}
			if (result || notFound) {
				var operation = null;
				config.debug && console.log('handleMongoGetResult options', options, result);
				var data = result;
				if (options.attribute) {
					data = result[options.attribute];
				}
				var version = 0;
				if (options.type == 'json') {
					if (data instanceof String) {
						data = JSON.parse(data);
					}
					operation = { op: [
						{ p: [], oi: data, od: null }
					], v: version };
				} else if (options.type == 'text') {
					operation = { op: [
						{i: data, p: 0}
					], v: version };
				}
				if (operation) {
					model.applyOp(options.documentId, operation, function appliedOp(error, version) {
						options.debug && console.log('getResult applyOp version', version);
						if (error) {
							options.error && console.log('ERR2 handleMongoGetResult', error);
						}
					});
				}
			}
		}

		return handleResult;
	}

	model.on('create', function populateDocument(documentId, data) {
		config.debug && console.log('Populating a doc in channel', documentId, data);
		var splitId = documentId.split(':');
		var options = {
			documentId: documentId,
			type: splitId[0],
			collection: splitId[1],
			attribute: null
		};
		if (splitId.length == 4) {
//			options.query = {_id: splitId[2]};
			options.query = {name: splitId[2]};
			options.attribute = splitId[3];
			mongoDataInstance.getMongoAttribute(options, handleMongoGetResult(options));
		} else {
			options.query = {name: splitId[2]};
			mongoDataInstance.getMongoContent(options, handleMongoGetResult(options));
		}
	});


	function handleMongoSetResult(options, current, callback) {
		function handleResult(err, result) {
			if (err) {
				config.errors && console.log('ERR1 handleMongoSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback && callback(err);
			}
			config.debug && console.log('current', current, 'result', result, 'options', options);
			if ((!current || !current.name) && (result.name || options.name)) {
				var name = result.name || options.name;
				var operation = { op: [
					{ p: ['name'], oi: name, od: null }
				], v: options.operation.v };
				return model.applyOp(options.documentId, operation, function appliedOp(error, version) {
					config.debug && console.log('setResult applyOp version', version);
					if (error) {
						config.error && console.log('ERR2 handleMongoSetResult', error);
						return callback && callback(error);
					}
					return callback && callback(null, version);
				});
			} else {
				return callback(null, null);
			}
		}

		return handleResult;
	}

	function handleMongoAttributeSetResult(options, current, callback) {
		function handleResult(err, result) {
			if (err) {
				config.errors && console.log('ERR1 handleMongoAttributeSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback(err);
			}
			config.debug && console.log('current', current, 'result', result);
			return callback(null, null);
		}

		return handleResult;
	}

	var timers = {};

	function handleSetTimeout(documentId) {
		return function saveContent() {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && console.log('running timer', documentId);
			mongoDataInstance.setMongoContent(args.current, args.options,
				handleMongoSetResult(args.options, args.current,
					function handleApplyOpResult(err, version) {
						if (err) {
							config.errors && console.log('ERR2 applyOp', version, err);
						}
					}));
		};
	}

	function handleSetAttributeTimeout(documentId) {
		return function saveAttribute() {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && console.log('running timer', documentId);
			var data = args.current;
			if (args.options.type == 'json') {
				data = JSON.parse(args.current);
			}
			mongoDataInstance.setMongoAttribute(data, args.options,
				handleMongoAttributeSetResult(args.options, data,
					function handleApplyOpResult(err, version) {
						if (err) {
							config.errors && console.log('ERR1 applyOp', documentId, version, err);
						}
					}));
		};
	}

	// 'applyOp' event is fired when an operational transform is applied to to a shareDoc
	// a shareDoc has changed and needs to be saved to mongo
	model.on('applyOp', function persistDocument(documentId, operation, current) {
		config.debug && console.log('applyOp', documentId, operation, current);
		if (operation.v == 0) return;

		var splitId = documentId.split(':');
		var options = {
			documentId: documentId,
			type: splitId[0],
			collection: splitId[1],
			name: splitId[2],
			attribute: null,
			operation: operation,
			no_share: true // prevent circular updates.
		};
		var timer = {
			current: current,
			options: options
		};
		var attribute = false;
		if (splitId.length == 4) {
//			options.query = {_id: splitId[2]};
			options.query = {name: splitId[2]};
			options.attribute = splitId[3];
			attribute = true;
		} else {
			options.query = {name: splitId[2]};
		}
		if (timers[documentId]) {
			timer.timer_id = timers[documentId].timer_id;
			timers[documentId] = timer;
			config.debug && console.log('resetting timer', documentId);
		} else {
			timers[documentId] = timer;
			if (attribute) {
				timer.timer_id = setTimeout(
					handleSetAttributeTimeout(documentId),
					config.savedelay);
			} else {
				timer.timer_id = setTimeout(
					handleSetTimeout(documentId),
					config.savedelay);
			}
			config.debug && console.log('setting timer', documentId);
		}
	});

	var previewInstance = preview(config, mongoDataInstance);

	route = config.api.preview + '/:collection/:name.:ext(html|md)';
	app.get(route,
		function getPreviewContent(req, res, next) {
			config.debug && console.log('/page/:collection/:name.:ext(html|md)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name},
				req: { query: req.query || {},
					headers: req.headers
				}
			};
			if (options.ext == 'md') {
				var attribute_parts = options.query.name.split('.');
				var markdownTag = 'markdown__' + options.collection + '_' + attribute_parts[0] + '_' + attribute_parts[1];
				//var markdownDocument=helpers.marker_prefix + markdownTag + helpers.marker_postfix;
				// TODO: remove hardcoded marker
				var markdownDocument = '<!-- @@' + markdownTag + ' -->';
				return previewInstance.getPreviewHTML(markdownDocument, { req: options.req },
					responder(options, res, next)
				);
			}
			return mongoDataInstance.getMongoContent(options, function handleResult(err, result) {
				if (err) {
					return responder(options, res, next)(err, result);
				}
				if (result) {
					var attribute_parts = options.query.name.split('.');
					var attribute = attribute_parts[attribute_parts.length - 1];
					var attribute_value = result[attribute];
					if (attribute_value) {
						options.name = attribute_parts[0];
						var preview_options = {
							collection: options.collection,
							name: options.name,
							attribute: attribute,
							query: {_id: result._id},
							req: options.req
						};

						config.debug && console.log('getPreviewContent content', attribute_value);
						return previewInstance.getPreviewHTML(attribute_value, preview_options,
							responder(options, res, next)
						);
					} else {
						return next();
					}
				} else {
					return next();
				}
			});
		}
	);

	var importerInstance = importer(config, mongoDataInstance);

	route = config.api.importer + '/:filename';
	app.get(route, function importFile(req, res, next) {
		var filename = path.resolve(config.statics.importer_path, req.params.filename);
		config.debug && console.log('/importer/:filename', filename);
		fs.readFile(filename, 'utf-8', function handleFileContent(err, sub_doc) {
			if (err) {
				config.errors && console.log('ERR readFile', filename, err);
				next(err);
			}
			// process with leftover marker support
			var options = {};
			importerInstance.importer(sub_doc, options,
				responder(options, res, next)
			);
		});
	});

	return server;
};
