"use strict";
process.title = "Prototyper";

var mime = require('mime');
var connect = require('connect');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var addRoutes = require('./lib/routes.js');
var shareServer = require('./lib/share.js');
var shareHandlers = require('./lib/shareHandlers.js');
var mongoData = require('./lib/mongoData.js');
var preview = require('./lib/preview.js');
var importer = require('./lib/importer.js');
var handlers = require('./lib/handlers.js');
var markers = require('./lib/markers.js');
var helpers = require('./lib/helpers.js');

mime.define({
	'text/css': ['css', 'less']
});

var config = {
	debug: function () {
		if (process.env.DEBUG) {
			console.log(JSON.stringify(arguments));
		}
	},
	error: function () {
		console.error(JSON.stringify(arguments));
	},
	errors: true,
	port: process.env.npm_package_config_port || 8000,
	mongo: {
		server: "mongodb://localhost:27017/Prototyper",
		options: {
			db: {
				native_parser: true,
				fsync: true
			},
			server: {
				maxPoolSize: 10,
				auto_reconnect: true
			}
		},
		savedelay: 200
	},
	share: {
		sockjs: {
			websocket: true
		},
		staticpath: '/lib/share',
		db: {type: 'none'}
//		db: {
//			type: 'mongo',
//			opsCollectionPerDoc: false
//		}
	},
	api: {
		content: '/content',
		data: '/data',
		preview: '/page',
		importer: '/importer'
	},
	statics: {
		dev_favicon_path: __dirname + '/public/favicon_dev.ico',
		importer_path: __dirname + '/public',
		public_path: __dirname + '/public',
		doc_path: __dirname + '/doc',
		markdown_client: __dirname + '/node_modules/markdown/lib',
		ace_client: __dirname + '/node_modules/share/examples/lib/ace',
		async_client: __dirname + '/node_modules/async/lib'
	}
};

if (config.debug) {
	config.debug('config loaded');
}

var app = express();
if (config.debug) {
	app.use(connect.logger());
}
//noinspection JSUnresolvedFunction
app.use(express.compress());

if (!process.env.NODE_ENV) {
	app.get('/favicon.ico', function (req, res) {
		res.sendfile(config.statics.dev_favicon_path, null, null);
	});
}
//noinspection JSUnresolvedFunction
app.use(express.static(config.statics.public_path));
//noinspection JSUnresolvedFunction
app.use('/doc', express.static(config.statics.doc_path));
//noinspection JSUnresolvedFunction
app.use('/lib/markdown', express.static(config.statics.markdown_client));
//noinspection JSUnresolvedFunction
app.use('/lib/ace', express.static(config.statics.ace_client));
//noinspection JSUnresolvedFunction
app.use('/lib/async', express.static(config.statics.async_client));

if (config.debug) {
	config.debug('static routes set');
}

var markerInstance = markers(config);
var helperInstance = helpers(markerInstance);

MongoClient.connect(config.mongo.server, config.mongo.options, function connection(err, db) {
	if (err) {
		if (config.error) {
			config.error('ERR connection to database', err);
		}
		return process.exit(3);
	}
	if (config.debug) {
		config.debug('database connected');
	}

	var share = shareServer(config, app, db);
	var model = share.model;
	var server = share.server;

	if (config.debug) {
		config.debug('share attached');
	}

	var mongoDataInstance = mongoData(config, db, model);

	if (config.debug) {
		config.debug('mongodata initialized');
	}

	shareHandlers(config, model, mongoDataInstance);

	if (config.debug) {
		config.debug('shareHandlers attached');
	}

	var previewInstance = preview(config, mongoDataInstance, helperInstance, markerInstance);

	if (config.debug) {
		config.debug('previews initialized');
	}

	var importerInstance = importer(config, mongoDataInstance, helperInstance, markerInstance);

	if (config.debug) {
		config.debug('importer initialized');
	}

	var handlerInstance = handlers(mongoDataInstance, previewInstance, importerInstance);

	if (config.debug) {
		config.debug('handlers initialized');
	}

	app = addRoutes(app, handlerInstance, markers, config);

	if (config.debug) {
		config.debug('routes added');
	}

	function exit(code) {
		db.close();
		process.exit(code);
	}

	server.on('error', function (err) {
		if (config.error) {
			config.error('Server error', err);
		}
		if (err.code && err.code === 'EADDRINUSE') {
			exit(2);
		}
	});

	return server.listen(config.port, function handleServerResult(err) {
		if (err) {
			if (config.error) {
				console.error('Server error', err);
			}
			return exit(1);
		}
		if (config.debug) {
			config.debug('routes', app.routes);
		}
		return console.log('Server running at http://127.0.0.1:', config.port);
	});
});


