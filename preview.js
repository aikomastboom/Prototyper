var Handlebars = require('handlebars');
var markdown = require('markdown').markdown;
var _ = require('underscore');
var less = require('less');
var when = require('when');

module.exports = function (config, mongodataInstance) {

	var sourceHead =
		'<script src="//cdnjs.cloudflare.com/ajax/libs/modernizr/2.6.2/modernizr.min.js"></script>\n' +
			'{{#if debug}}' +
			'<link href="/content/{{collection}}/{{name}}/style.css" media="all" rel="stylesheet/less" type="text/css">\n' +
			'<script src="//cdnjs.cloudflare.com/ajax/libs/less.js/1.3.3/less.min.js"></script>\n' +
			'{{else}}' +
			'<link href="/content/{{collection}}/{{name}}/style.css" media="all" rel="stylesheet" type="text/css">\n' +
			'{{/if}}';

	var getPreviewHTML = function (options, content, callback) {
		config.debug && console.log('getPreviewHTML', content);
		var html = content;
		var promises = replaceMarkers(options, html);
		when.all(
			promises,
			function onSucces(all_results) {
				console.log('getPreviewHTML replaceMakers results', all_results);
				_.forEach(all_results, function (results) {
					_.forEach(results, function (result) {
						html = html.replace(result.regExp, result.replacement);
					});
				});
				return callback(null, html);
			},
			function onFailure(err) {
				return callback(err);
			}
		)
	};

	var replaceMarkers = function (options, html) {

		function replace(marker, getReplacement, once) {
			var deferred = when.defer();
			var regExp = new RegExp('<!--\\s*@@' + marker + '\\s*-->', 'gmi');
			var matches = html.match(regExp);
			if (matches) {
				if (once) {
					matches = [matches[0]];
				}
				var match_promisses = [];
				_.forEach(matches, function (result) {
					var deferred2 = when.defer();
					match_promisses.push(deferred2.promise);
					getReplacement(result, function (err, replacement) {
						if (err) {
							deferred2.reject(err);
						} else {
							deferred2.resolve({regExp: replacement.regExp || regExp, replacement: replacement.value})
						}
					})
				});
				when.all(
					match_promisses,
					function onSuccess(results) {
						deferred.resolve(results);
					},
					function onFailure(err) {
						deferred.reject(err);
					}
				);
			} else {
				deferred.resolve();
			}
			return deferred.promise;
		}

		console.log('marker options', options);
		var promises = [];
		/* markers:
		 [type]_[collection]_[name]_[attribute]

		 script   -> <script src="/content/collection/name/attribute.js"/>
		 style    -> <link href="/content/collection/name/attribute.css" media="all" rel="stylesheet" type="text/css">


		 markdown_[collection]_[nameX]_[attribute]
		 markdown -> parse /content/collection/name/attribute into html and include

		 template_[collectionX]_[nameX]_[attributeX]_context_[collectionY]_[nameY]
		 template -> put /content/collectionX/nameX/attributeX thru handlebars.. context=collectionY/nameY/attributeY and include

		 remove_.*_end_remove
		 remove_ -> removes markers and everything in between

		 [type]_[collection]_[name]
		 script   -> <script src="/content/collection/name.js"/>
		 contains all type='script' attributes concatenated based on 'order'
		 style    -> <link href="/content/collection/name.css" media="all" rel="stylesheet" type="text/css">
		 contains all type='style' attributes concatenated based on 'order'
		 */
		var script_tag = 'script_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var script_regexp = new RegExp(script_tag);
		promises.push(
			replace(script_tag, function (result, callback) {
				var parts = script_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value: '<script src="/content/' + context.collection + '/' + context.name + '/' + context.attribute + '.js"></script>'
				});
			}));

		var style_tag = 'style_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var style_regexp = new RegExp(style_tag);
		promises.push(
			replace(style_tag, function (result, callback) {
				var parts = style_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value: '<link href="/content/' + context.collection + '/' + context.name + '/' + context.attribute + '.css" media="all" rel="stylesheet" type="text/css">'
				});
			}));

		var template_tag = 'template_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_context_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var template_regexp = new RegExp(template_tag);
		promises.push(
			replace(template_tag, function (result, callback) {
				var parts = template_regexp.exec(result);
				var template = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				var context = {
					collection: parts[4],
					name: parts[5],
					query: { name: parts[5]},
					req: options.req
				};
				mongodataInstance.getMongoAttribute(template, function (err, attribute_result) {
					if (err) {
						return callback(err);
					}
					var template = Handlebars.compile(attribute_result[template.attribute]);
					mongodataInstance.getMongoContent(context, function (err, context_result) {
						if (err) {
							return callback(err);
						}
						var rendered = template(context_result);
						config.debug && console.log('// recurse markers on rendered template');
						context.query = {_id: context_result._id};
						getPreviewHTML(context, rendered, function (err, html) {
							if (err) {
								return callback(err);
							}
							return callback(null, {
								regExp: new RegExp(result, 'gmi'),
								value: html
							});
						})
					});
				});
			}));

		var markdown_tag = 'style_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var markdown_regexp = new RegExp(markdown_tag);
		promises.push(
			replace('markdown_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)', function (result, callback) {
				var parts = markdown_regexp.exec(result);
				var attribute = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				mongodataInstance.getMongoAttribute(attribute, function (err, attribute_result) {
					if (err) {
						return callback(err);
					}
					var html = markdown.toHTML(attribute_result[options.attribute]);
					return callback(null, {
						regExp: new RegExp(result, 'gmi'),
						value: html
					});
				});
			}));

		var remove_tag = 'style_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		//var remove_regexp = new RegExp(remove_tag);
		promises.push(
			replace('remove_([\\w\\W]*)_end_remove', function (result, callback) {
				return callback(null, {
					regExp: null,
					value: ""
				});
			}, true));

		return promises;
	};


	return {
		getPreviewHTML: getPreviewHTML,
		_replaceMarkers: replaceMarkers
	};
};

