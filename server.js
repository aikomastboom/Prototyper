var connect = require('connect');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var addRoutes = require('./routes.js');

process.title = "Prototyper";

var config = {
	errors: true,
	debug: false,
	port: 8000,
	mongo: {
		server: "mongodb://silo01.local:27017/Prototyper",
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
		sockjs: {},
		staticpath: '/lib/share',
		db: {type: 'none'}
	},
	api: {
		content: '/content',
		data: '/data',
		preview: '/page',
		importer: '/importer'
	},
	statics: {
		importer_path: __dirname + '/public',
		public_path: __dirname + '/public',
		markdown_client: __dirname + '/node_modules/markdown/lib',
		ace_client: __dirname + '/node_modules/share/examples/lib/ace'
	}
};

var app = express();
config.debug && app.use(connect.logger());
//noinspection JSUnresolvedFunction
app.use(express.static(config.statics.public_path));
//noinspection JSUnresolvedFunction
app.use('/lib/markdown', express.static(config.statics.markdown_client));
//noinspection JSUnresolvedFunction
app.use('/lib/ace', express.static(config.statics.ace_client));

MongoClient.connect(config.mongo.server, config.mongo.options, function connection(err, db) {
	if (err) {
		config.errors && console.log('ERR connection to database', err);
		return process.exit(1);
	}
	var server = addRoutes(app, db, config);
	return server.listen(config.port, function handleServerResult(err) {
		if (err) {
			app.stop();
			console.log('Server error', err);
			return process.exit(1);
		}
		config.debug && console.log('routes', app.routes);
		return console.log('Server running at http://127.0.0.1:', config.port);
	});
});


