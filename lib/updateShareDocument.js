'use strict';
var _ = require('underscore');

module.exports = function (config, shareModel) {

	function updateShareDocumentPath(documentId, data, path, callback) {
		shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.warn && config.warn('WARN updateShareDocumentPath shareModel.getSnapshot', documentId, err);
				return callback && callback();
			}
			var sub_data          = data;
			var sub_snapshot_data = doc.snapshot;
			var equal_path        = [];
			var found             = false;
			var x;
			for (x = 0; !found && x < path.length; x += 1) {
				var key = path[x];
				if (sub_data && sub_data.hasOwnProperty(key) &&
					sub_snapshot_data &&
					sub_snapshot_data.hasOwnProperty(key)) {
					sub_data          = sub_data[key];
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
			return shareModel.applyOp(documentId, {
				op: [op],
				v:  doc.v
			}, function (err, result) {
				if (err) {
					config.error && config.error('ERR updateShareDocumentPath shareModel.applyOp', documentId, err);
					return callback && callback();
				}
				config.debug && config.debug('updateShareDocumentPath shareModel.applyOp', documentId, op, err, result);
				return callback && callback();

			});
		});
	}

	function updateShareDocument(documentId, data, keys, callback) {
		if (!keys) {
			// no keys no update
			return callback && callback();
		}
		var ops = [];
		return shareModel.getSnapshot(documentId, function (err, doc) {
			if (err) {
				config.warn && config.warn('WARN updateShareDocument shareModel.getSnapshot', documentId, err);
				return callback && callback();
			}
			if (doc.type.name === 'text') {
				ops.push({
					d: doc.snapshot,
					p: 0
				});
				ops.push({
					i: data,
					p: 0
				});
			} else if (doc.type.name === 'json') {
				_.forEach(keys, function (key) {
					if (key !== 'id') {
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
			}
			return shareModel.applyOp(documentId, {
				op: ops,
				v:  doc.v
			}, function (err, result) {
				if (err) {
					config.warn && config.warn('WARN updateShareDocument shareModel.applyOp', documentId, err);
					return callback && callback();
				}
				config.debug && config.debug('updateShareDocument shareModel.applyOp', documentId, ops, err, result);
				return callback && callback();
			});
		});
	}

	return {
		document: updateShareDocument,
		documentPath: updateShareDocumentPath
	};
};
