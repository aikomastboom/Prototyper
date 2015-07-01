'use strict';
process.title = 'Prototyper';

var connect       = require('connect');
var express       = require('express');
var MongoClient   = require('mongodb').MongoClient;
var addRoutes     = require('./lib/routes.js');
var shareServer   = require('./lib/share.js');
var shareHandlers = require('./lib/shareHandlers.js');
var mongoData     = require('./lib/mongoData.js');
var preview       = require('./lib/preview.js');
var importer      = require('./lib/importer.js');
var handlers      = require('./lib/handlers.js');
var markers       = require('./lib/markers.js');
var helpers       = require('./lib/helpers.js');

var config = {
	debug:   function () {
		if (process.env.DEBUG) {
			var error = arguments[0] && arguments[0].message ||
				arguments[1] && arguments[1].message ||
				arguments[2] && arguments[2].message;
			var args  = Array.prototype.slice.call(arguments);
			var log   = {
				level:     'debug',
				message:   args,
				timestamp: Date.now(),
				error:     error
			};
			console.log(JSON.stringify(log));
		}
	},
	info:    function () {
		var error = arguments[0] && arguments[0].message ||
			arguments[1] && arguments[1].message ||
			arguments[2] && arguments[2].message;
		var args  = Array.prototype.slice.call(arguments);
		var log   = {
			level:     'info',
			message:   args,
			timestamp: Date.now(),
			error:     error
		};
		console.log(JSON.stringify(log));
	},
	warn:    function () {
		var error = arguments[0] && arguments[0].message ||
			arguments[1] && arguments[1].message ||
			arguments[2] && arguments[2].message;
		var args  = Array.prototype.slice.call(arguments);
		var log   = {
			level:     'warn',
			message:   args,
			timestamp: Date.now(),
			error:     error
		};
		console.warn(JSON.stringify(log));
	},
	error:   function () {
		var error = arguments[0] && arguments[0].message ||
			arguments[1] && arguments[1].message ||
			arguments[2] && arguments[2].message;
		var args  = Array.prototype.slice.call(arguments);
		var log   = {
			level:     'error',
			message:   args,
			timestamp: Date.now(),
			error:     error
		};
		console.error(JSON.stringify(log));
	},
	port:    process.env.npm_package_config_port || 8000,
	mongo:   {
		server:    'mongodb://localhost:27017/Prototyper',
		options:   {
			db:     {
				native_parser: true,
				fsync:         true
			},
			server: {
				maxPoolSize:    10,
				auto_reconnect: true
			}
		},
		savedelay: 200
	},
	share:   {
		sockjs:     {
			prefix:           '',
			response_limit:   128 * 1024,
			websocket:        true,
			jsessionid:       false,
			heartbeat_delay:  25000,
			disconnect_delay: 5000,
			log:              function (severity, line) {
				if (process.env.DEBUG) {
					if (severity === 'info') {
						config.info && config.info(severity, line);
					} else if (severity === 'error') {
						config.error && config.error(severity, line);
					} else {
						config.debug && config.debug(severity, line);
					}
				}
			},
			sockjs_url:       'https://cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js'
		},
		staticpath: '/lib/share',
		db:         {type: 'none'}
//		db: {
//			type: 'mongo',
//			opsCollectionPerDoc: false
//		}
	},
	api:     {
		content:  '/content',
		data:     '/data',
		preview:  '/page',
		importer: '/importer'
	},
	statics: {
		dev_favicon_path: __dirname + '/public/favicon_dev.ico',
		importer_path:    __dirname + '/public',
		public_path:      __dirname + '/public',
		doc_path:         __dirname + '/doc',
		markdown_client:  __dirname + '/node_modules/markdown/lib',
		ace_client:       __dirname + '/node_modules/share/examples/lib/ace',
		async_client:     __dirname + '/node_modules/async/lib'
	}
};

config.debug && config.debug('config loaded');

var app = express();

express.static.mime.define({
	'text/css': ['css', 'less']
});

if (process.env.DEBUG) {
	//app.use(connect.logger());
	var stream = {
		write: function (str) {
			config.debug && config.debug(str);
		}
	};
	app.use(connect.logger({immediate: false, format: 'dev', stream: stream}));
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

config.debug && config.debug('static routes set');

var markerInstance = markers(config);
var helperInstance = helpers(markerInstance);

MongoClient.connect(config.mongo.server, config.mongo.options, function connection(err, db) {
	if (err) {
		config.error && config.error('ERR connection to database', err);
		return process.exit(3);
	}
	config.debug && config.debug('database connected');

	var share  = shareServer(config, app, db);
	var model  = share.model;
	var server = share.server;

	config.debug && config.debug('share attached');

	var mongoDataInstance = mongoData(config, db, model);

	config.debug && config.debug('mongodata initialized');

	shareHandlers(config, model, mongoDataInstance);

	config.debug && config.debug('shareHandlers attached');

	var previewInstance = preview(config, mongoDataInstance, helperInstance, markerInstance);

	config.debug && config.debug('previews initialized');

	var importerInstance = importer(config, mongoDataInstance, helperInstance, markerInstance);

	config.debug && config.debug('importer initialized');

	var handlerInstance = handlers(mongoDataInstance, previewInstance, importerInstance);

	config.debug && config.debug('handlers initialized');

	app = addRoutes(app, handlerInstance, markers, config);

	config.debug && config.debug('routes added');

	function exit(code) {
		db.close();
		// Probably there are also some other listeners for uncaughtException,
		// so we postpone process.exit
		process.nextTick(function () {
			process.exit(code);
		});
	}

	process.on('uncaughtException', function (err) {
		config.error && config.error('HALTING ON UNCAUGHT EXCEPTION:' + err.message, err);
		config.error && config.error(err.stack);
		config.error && config.error('EXIT 1');
		return exit(1);
	});

	server.on('error', function (err) {
		config.error && config.error('Server error', err);
		if (err.code && err.code === 'EADDRINUSE') {
			return exit(2);
		}
	});

	return server.listen(config.port, function handleServerResult(err) {
		if (err) {
			console.error('Server error', err);
			return exit(1);
		}
		config.debug && config.debug('routes', app.routes);
		return config.info && config.info('Server running at http://127.0.0.1:' + config.port);
	});
});


