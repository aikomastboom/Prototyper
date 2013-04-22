var connect = require('connect');
var express = require('express');
var instance = require('./routes.js');

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


var server = instance(app, config);

server.listen(config.port, function handleServerResult(err) {
	if (err) {
		app.stop();
		console.log('Server error', err);
		return process.exit(1);
	}
	config.debug && console.log('routes', app.routes);
	return console.log('Server running at http://127.0.0.1:', config.port);
});
