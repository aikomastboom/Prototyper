module.exports = function (config, model, mongoDataInstance) {
	"use strict";
	var timers = {};

	function handleMongoGetResult(options) {
		function handleResult(err, result) {
			var notFound = false;
			if (err) {
				if (/Data not found*/.test(err.message)) {
					config.debug && config.debug('handleMongoGetResult.handleResult Document/Attribute not found, It will be created on first OT');
					result = {};
					if (options.attribute) {
						if (options.type === 'json') {
							result[options.attribute] = {};
						} else {
							result[options.attribute] = "";
						}
					}
					notFound = true;
				} else {
					config.error && config.error('ERR1 handleMongoGetResult.handleResult Error retrieving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				}
			}
			if (result || notFound) {
				var operation = null;
				config.debug && config.debug('handleMongoGetResult options', options, result);
				var data = result;
				if (options.attribute) {
					data = result[options.attribute];
				}
				var version = 0;
				if (options.type === 'json') {
					if (data instanceof String) {
						data = JSON.parse(data);
					}
					operation = { op: [
						{ p: [], oi: data, od: null }
					], v: version };
				} else if (options.type === 'text') {
					operation = { op: [
						{i: data, p: 0}
					], v: version };
				}
				if (operation) {
					model.applyOp(options.documentId, operation, function appliedOp(error, version) {
						config.debug && config.debug('getResult applyOp version', version);
						if (error) {
							config.error && config.error('ERR2 handleMongoGetResult', error);
						}
					});
				}
			}
		}

		return handleResult;
	}

	model.on('create', function populateDocument(documentId, data) {
		config.debug && config.debug('Populating a doc in channel', documentId, data);
		var splitId = documentId.split(':');
		var options = {
			documentId: documentId,
			type: splitId[0],
			collection: splitId[1],
			attribute: null
		};
		if (splitId.length === 4) {
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
				config.error && config.error('ERR1 handleMongoSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback && callback(err);
			}
			config.debug && config.debug('current', current, 'result', result, 'options', options);
			if ((!current || !current.name) && (result.name || options.name)) {
				var name = result.name || options.name;
				var operation = { op: [
					{ p: ['name'], oi: name, od: null }
				], v: options.operation.v };
				model.applyOp(options.documentId, operation, function appliedOp(error, version) {
					config.debug && config.debug('setResult applyOp version', version);
					if (error) {
						config.error && config.error('ERR2 handleMongoSetResult', error);
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
				config.error && config.error('ERR1 handleMongoAttributeSetResult Error while saving document ', options.collection, JSON.stringify(options.query), options.attribute || "", err);
				return callback(err);
			}
			config.debug && config.debug('current', current, 'result', result);
			return callback(null, null);
		}

		return handleResult;
	}


	function handleSetTimeout(documentId) {
		return function saveContent() {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && config.debug('running timer', documentId);
			mongoDataInstance.setMongoContent(args.current, args.options,
				handleMongoSetResult(args.options, args.current,
					function handleApplyOpResult(err, version) {
						if (err) {
							config.error && config.error('ERR2 applyOp', version, err);
						}
					}));
		};
	}

	function handleSetAttributeTimeout(documentId) {
		return function saveAttribute() {
			var args = timers[documentId];
			delete timers[documentId];
			config.debug && config.debug('running timer', documentId);
			var data = args.current;
			if (args.options.type === 'json') {
				data = JSON.parse(args.current);
			}
			mongoDataInstance.setMongoAttribute(data, args.options,
				handleMongoAttributeSetResult(args.options, data,
					function handleApplyOpResult(err, version) {
						if (err) {
							config.error && config.error('ERR1 applyOp', documentId, version, err);
						}
					}));
		};
	}

	// 'applyOp' event is fired when an operational transform is applied to to a shareDoc
	// a shareDoc has changed and needs to be saved to mongo
	model.on('applyOp', function persistDocument(documentId, operation, current) {
		config.debug && config.debug('applyOp', documentId, operation, current);
		if (operation.v === 0) {
			return;
		}

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
		if (splitId.length === 4) {
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
			config.debug && config.debug('resetting timer', documentId);
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
			config.debug && config.debug('setting timer', documentId);
		}
	});
};
