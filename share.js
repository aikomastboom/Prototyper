var ShareJS = require('share');

module.exports = function (config, app, db) {
	// share wraps express app with http.Server
	if (config
		&& config.share
		&& config.share.db
		&& config.share.db.type == 'mongo') {
		config.share.db.client = db;
	}
	var server = ShareJS.server.attach(app, config.share);
	var model = app.model;

	return {
		server: server,
		model: model
	};
};
