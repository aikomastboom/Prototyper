var responder = require('./responder.js');

var path = require('path');
var fs = require('fs');

module.exports = function (app, handlers, config) {

	var route;
	route = config.api.data + '/:collection/:guid/:attribute.:ext(css|less|js|html)';
	app.get(route,
		function getAttributeByGUID(req, res, next) {
			config.debug && console.log('/data/:collection/:guid/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			handlers.getAttribute(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.data + '/:collection/:guid.:ext(json)';
	app.get(route,
		function getContentByGUID(req, res, next) {
			config.debug && console.log('/data/:collection/:guid.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {_id: req.params.guid}
			};
			handlers.getContent(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.content + '/:collection/:name/:attribute.:ext(css|less|js|html)';
	app.get(route,
		function getAttributeByName(req, res, next) {
			config.debug && console.log('/content/:collection/:name/:attribute.:ext(less|js|html)');
			var options = {
				collection: req.params.collection,
				attribute: req.params.attribute,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			handlers.getAttribute(options,
				responder(options, res, next)
			);
		}
	);

	route = config.api.content + '/content/:collection/:name.:ext(json)';
	app.get(route,
		function getContentByName(req, res, next) {
			config.debug && console.log('/content/:collection/:name.:ext(json)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name}
			};
			handlers.getContent(options,
				responder(options, res, next)
			);
		}
	);


	route = config.api.preview + '/:collection/:name.:ext(html|md)';
	app.get(route,
		function getPreviewContent(req, res, next) {
			config.debug && console.log('/page/:collection/:name.:ext(html|md)');
			var options = {
				collection: req.params.collection,
				ext: req.params.ext,
				query: {name: req.params.name},
				req: { query: req.query || {},
					headers: req.headers
				}
			};
			if (options.ext == 'md') {
				var attribute_parts = options.query.name.split('.');
				var markdownTag = 'markdown__' + options.collection + '_' + attribute_parts[0] + '_' + attribute_parts[1];
				//var markdownDocument=helpers.marker_prefix + markdownTag + helpers.marker_postfix;
				// TODO: remove hardcoded marker
				var markdownDocument = '<!-- @@' + markdownTag + ' -->';
				return handlers.getPreviewHTML(markdownDocument, { req: options.req },
					responder(options, res, next)
				);
			}
			return handlers.getContent(options, function handleResult(err, result) {
				if (err) {
					return responder(options, res, next)(err, result);
				}
				if (result) {
					var attribute_parts = options.query.name.split('.');
					var attribute = attribute_parts[attribute_parts.length - 1];
					var attribute_value = result[attribute];
					if (attribute_value) {
						options.name = attribute_parts[0];
						var preview_options = {
							collection: options.collection,
							name: options.name,
							attribute: attribute,
							query: {_id: result._id},
							req: options.req
						};

						config.debug && console.log('getPreviewContent content', attribute_value);
						return handlers.getPreviewHTML(attribute_value, preview_options,
							responder(options, res, next)
						);
					} else {
						return next();
					}
				} else {
					return next();
				}
			});
		}
	);


	route = config.api.importer + '/:filename';
	app.get(route, function importFile(req, res, next) {
		var filename = path.resolve(config.statics.importer_path, req.params.filename);
		config.debug && console.log('/importer/:filename', filename);
		fs.readFile(filename, 'utf-8', function handleFileContent(err, sub_doc) {
			if (err) {
				config.errors && console.log('ERR readFile', filename, err);
				next(err);
			}
			// process with leftover marker support
			var options = {};
			handlers.importer(sub_doc, options,
				responder(options, res, next)
			);
		});
	});

	return app;
};
