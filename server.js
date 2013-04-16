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
				maxPoolSize:10,
				auto_reconnect:true
			}
		}
	},
	share: {
		sockjs: {},
		db: {type: 'none'}
	}
};

var server = express.createServer();
server.use(connect.logger());
server.use(express.static(__dirname + '/public'));

instance(server, config);

server.listen(config.port, function (err) {
//	console.log('routes',server.routes);
	console.log('Server running at http://127.0.0.1:', config.port);
});
