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
			server: {
				maxPoolSize: 10,
				auto_reconnect: true
			}
		},
		savedelay: 200
	},
	share: {
		sockjs: {},
		db: {type: 'none'}
	}
};

var app = express();
config.debug && app.use(connect.logger());
app.use(express.static(__dirname + '/public'));


var server = instance(app, config);

server.listen(config.port, function (err) {
	config.debug && console.log('routes',server.routes);
	console.log('Server running at http://127.0.0.1:', config.port);
});
