var sharejs = require('share');
var mongodata = require('./mongodata.js');
var responder = require('./responder.js');
var preview = require('./preview.js');

module.exports = function (server, config) {

	// Attach the sharejs REST and Socket.io interfaces to the server
	sharejs.server.attach(server, config.share);
	var model = server.model;


	var mongodataInstance = mongodata(config);

	server.get('/data/:collection/:guid/:attribute.:ext(css|less|js|html)',
		function getMongoAttribute(req, res, next) {
			config.debug && console.log('/data/:collection/:guid/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			mongodataInstance.getMongoAttribute(options,
				responder(options, res, next)
			);
		}
	);

	server.get('/data/:collection/:guid.:ext(json)',
		function getMongoContent(req, res, next) {
			config.debug && console.log('/data/:collection/:guid.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			mongodataInstance.getMongoContent(options,
				responder(options, res, next)
			);
		}
	);

	server.get('/content/:collection/:name/:attribute.:ext(css|less|js|html)',
		function getMongoAttribute(req, res, next) {
			config.debug && console.log('/content/:collection/:name/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			mongodataInstance.getMongoAttribute(options,
				responder(options, res, next)
			);
		}
	);

	server.get('/content/:collection/:name.:ext(json)',
		function getMongoContent(req, res, next) {
			config.debug && console.log('/content/:collection/:name.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			mongodataInstance.getMongoContent(options,
				responder(options, res, next)
			);
		}
	);

	function handleMongoGetResult(options) {
		function handleResult(err, result) {
			if (err) {
				if (options.attribute && /Data not found*/.test(err.message)) {
					config.debug && console.log('handleMongoGetResult.handleResult Attribute not found, It will be created on first OT');
				} else {
					config.errors && console.log('ERR1 handleMongoGetResult.handleResult Error retrieving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				}
			} else {
				if (result) {
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
			options.query = {_id: splitId[2]};
			options.attribute = splitId[3];
			mongodataInstance.getMongoAttribute(options, handleMongoGetResult(options));
		} else {
			options.query = {name: splitId[2]};
			mongodataInstance.getMongoContent(options, handleMongoGetResult(options));
		}
	});


	function handleMongoSetResult(options, current, callback) {
		function handleResult(err, result) {
			if (err) {
				config.errors && console.log('ERR1 handleMongoSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback && callback(err);
			}
			config.debug && console.log('current', current, 'result', result, 'options', options);
			if ((!current || !current.name) && result.name) {
				var operation = { op: [
					{ p: ['name'], oi: result.name, od: null }
				], v: options.operation.v };
				model.applyOp(options.documentId, operation, function appliedOp(error, version) {
					config.debug && console.log('setResult applyOp version', version);
					if (error) {
						config.error && console.log('ERR2 handleMongoSetResult', error);
						return callback && callback(error);
					}
					return callback && callback(null, version);
				});
			}
		}

		return handleResult;
	}

	function handleMongoAttributeSetResult(options, current, callback) {
		function handleResult(err, result) {
			if (err) {
				config.errors && console.log('ERR1 handleMongoAttributeSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback && callback(err);
			}
			options.debug && console.log('current', current, 'result', result);
			if (result.hasOwnProperty('_id')) {
				config.debug && console.log('// new object created. need to update the parent object.');
				var pieces = options.documentId.split(':');
				var parentDocId = pieces[0] + ':' + pieces[1] + ':' + pieces[2];
				var operation = { op: [
					{ p: [options.attribute], oi: { guid: result._id }, od: null }
				], v: options.operation.v };

				model.applyOp(parentDocId, operation, function appliedOp(error, version) {
					config.debug && console.log('setResult applyOp parent version', version);
					if (error) {
						config.error && console.log('ERR2 handleMongoAttributeSetResult', error);
						return callback && callback(error);
					}
					return callback && callback(null, version);
				})
			}
		}
		return handleResult;
	}

	var timers = {};

	function handleSetTimeout(documentId) {
		return function () {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && console.log('running timer', documentId);
			mongodataInstance.setMongoContent(args.current, args.options,
				handleMongoSetResult(args.options, args.current,
					function (err, result) {
						if (err) {
							config.errors && console.log('ERR2 applyOp', err);
						}
				}));
		};
	}

	function handleSetAttributeTimeout(documentId) {
		return function () {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && console.log('running timer', documentId);
			var data = args.current;
			if (args.options.type == 'json') {
				data = JSON.stringify(args.current);
			}
			mongodataInstance.setMongoAttribute(data, args.options,
				handleMongoAttributeSetResult(args.options, data,
					function (err, result) {
						if (err) {
							config.errors && console.log('ERR1 applyOp', err);
						}
				}));
		};
	}

	// 'applyOp' event is fired when an operational transform is applied to to a shareDoc
	// a shareDoc has changed and needs to be saved to mongo
	model.on('applyOp', function persistDocument(documentId, operation, current, previous) {
		config.debug && console.log('applyOp', documentId, operation, current);
		if (operation.v == 0) return;

		var splitId = documentId.split(':');
		var options = {
			documentId: documentId,
			type: splitId[0],
			collection: splitId[1],
			attribute: null,
			operation: operation
		};
		var timer = {
			current: current,
			options: options
		};
		var attribute = false;
		if (splitId.length == 4) {
			options.query = {_id: splitId[2]};
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

	var previewInstance = preview(config);

	server.get('/page/:collection/:name.:ext(html)',
		function getPreviewContent(req, res, next) {
			config.debug && console.log('/page/:collection/:name.:ext(html)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name},
				debug: req.query && req.query.hasOwnProperty('debug')
			};
			mongodataInstance.getMongoContent(options, function (err, result) {
				if (err) {
					responder(options, res, next)(err, result);
				}
				if (result) {
					var attribute_parts = options.query.name.split('.');
					var attribute = attribute_parts[attribute_parts.length - 1];
					var content = result[attribute];
					options.name = attribute_parts[0];
					//options.attribute=attribute;
					config.debug && console.log('getPreviewContent content', content);
					previewInstance.getPreviewHTML(options, content,
						responder(options, res, next)
					);
				}
			});
		}
	);


};