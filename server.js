process.title = "Prototyper";

var connect = require('connect');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var addRoutes = require('./routes.js');
var shareServer = require('./share.js');
var shareHandlers = require('./shareHandlers.js');
var mongoData = require('./mongodata.js');
var preview = require('./preview.js');
var importer = require('./importer.js');
var handlers = require('./handlers.js');


var config = {
	errors: true,
	debug: process.env.DEBUG || false,
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
		markdown_client: __dirname + '/node_modules/markdown/lib',
		ace_client: __dirname + '/node_modules/share/examples/lib/ace',
		async_client: __dirname + '/node_modules/async/lib'
	}
};

config.debug && console.log('config loaded');

var app = express();
config.debug && app.use(connect.logger());
if (!process.env.NODE_ENV) {
	app.get('/favicon.ico', function (req, res) {
		res.sendfile(config.statics.dev_favicon_path);
	});
}
//noinspection JSUnresolvedFunction
app.use(express.static(config.statics.public_path));
//noinspection JSUnresolvedFunction
app.use('/lib/markdown', express.static(config.statics.markdown_client));
//noinspection JSUnresolvedFunction
app.use('/lib/ace', express.static(config.statics.ace_client));
//noinspection JSUnresolvedFunction
app.use('/lib/async', express.static(config.statics.async_client));

config.debug && console.log('static routes set');

MongoClient.connect(config.mongo.server, config.mongo.options, function connection(err, db) {
	if (err) {
		config.errors && console.log('ERR connection to database', err);
		return process.exit(1);
	}
	config.debug && console.log('database connected');

	var share = shareServer(app, db, config);
	var model = share.model;
	var server = share.server;

	config.debug && console.log('share attached');

	var mongoDataInstance = mongoData(config, db, model);

	config.debug && console.log('mongodata initialized');

	shareHandlers(config, model, mongoDataInstance);

	config.debug && console.log('sharehandlers attached');

	var previewInstance = preview(config, mongoDataInstance);

	config.debug && console.log('previews initialized');

	var importerInstance = importer(config, mongoDataInstance);

	config.debug && console.log('importer initialized');

	var handlerInstance = handlers(mongoDataInstance, previewInstance, importerInstance);

	config.debug && console.log('handlers initialized');

	app = addRoutes(app, handlerInstance, config);

	config.debug && console.log('routes added');

	server.on('error', function (err) {
		config.error && console.log('server error', err);
	});
	return server.listen(config.port, function handleServerResult(err) {
		if (err) {
			app.stop();
			console.error('Server error', err);
			return process.exit(1);
		}
		config.debug && console.log('routes', app.routes);
		return console.log('Server running at http://127.0.0.1:', config.port);
	});
});


