var Handlebars = require('handlebars');
var markdown = require('markdown').markdown;
var _ = require('underscore');
var less = require('less');
var when = require('when');
var helpers = require('./helpers.js');

module.exports = function (config, mongoDataInstance) {

	var getPreviewHTML = function (content, options, callback) {
		config.debug && console.log('getPreviewHTML', content);
		var promises = replaceMarkers(content, options);

		function handler(text, result) {
			return text.replace(result.regExp, result.replacement);
		}

		helpers.handTextManipulation(content,
			promises,
			handler,
			callback
		);
	};

	var replaceMarkers = function (html, options) {

		var promises = [];

		var script_tag = 'script__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var script_regexp = new RegExp(helpers.marker_prefix + script_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, script_tag, function handleScriptMarker(result, callback) {
				var parts = script_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value: '<script src="' + config.api.content + '/' + context.collection + '/' + context.name + '/' + context.attribute + '.js" type="text/javascript" charset="utf-8"></script>'
				});
			}));

		var style_tag = 'style__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var style_regexp = new RegExp(helpers.marker_prefix + style_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, style_tag, function handleStyleMarker(result, callback) {
				var parts = style_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value: '<link href="' + config.api.content + '/' + context.collection + '/' + context.name + '/' + context.attribute + '.css" media="all" rel="stylesheet" type="text/css">'
				});
			}));

		var less_tag = 'less__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var less_regexp = new RegExp(helpers.marker_prefix + less_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, less_tag, function handleStyleMarker(result, callback) {
				var parts = less_regexp.exec(result);
				var context = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3]
				};
				return callback(null, {
					regExp: new RegExp(result, 'gmi'),
					value: '<link href="' + config.api.content + '/' + context.collection + '/' + context.name + '/' + context.attribute + '.less" media="all" rel="stylesheet/less" type="text/css">'
				});
			}));

		var template_tag = 'template__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)__context__([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var template_regexp = new RegExp(helpers.marker_prefix + template_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, template_tag, function handleTemplateMarker(result, callback) {
				var parts = template_regexp.exec(result);
				var template = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3],
					query: { name: parts[2]}
				};
				var context = {
					collection: parts[4],
					name: parts[5],
					query: { name: parts[5]},
					req: options.req
				};
				return mongoDataInstance.getMongoContent(context, function handleContext(err, context_result) {
					if (err) {
						config.errors && console.log('ERR template_tag getMongoContent', context);
						return callback(err);
					}
					return mongoDataInstance.getMongoAttribute(template, function handleTemplate(err, template_result) {
						if (err) {
							config.errors && console.log('ERR template_tag getMongoAttribute', template, err);
							return callback(err);
						}
						var compiled_template = null;
						var keys_to_collect = {};

						function collectKey(key) {
							return function () {
								if (keys_to_collect.hasOwnProperty(key)) {
									return keys_to_collect[key];
								} else {
									keys_to_collect[key] = null;
									return "wating for content";
								}
							}
						}

						// Handlebars is synchronous ouch !!
						var handlebars = Handlebars.create();
						_.forEach(_.keys(context_result), function (key) {
							handlebars.registerHelper(key, function () {
								if (context_result[key].guid) {
									return collectKey(key)();
								}
								return context_result[key];
							});
						});
						try {
							compiled_template = handlebars.compile(template_result[template.attribute]);
						} catch (err) {
							config.errors && console.log('ERR template_tag Handlebars.compile', template, err);
							return callback(err);
						}
						var extendHandlebars_context = function (result) {
							var handlebars = {};
							_.forEach(_.keys(result), function (key) {
								if (result[key].guid) {
									handlebars[key] = collectKey(key);
								} else {
									handlebars[key] = result[key];
								}
							});
							return handlebars;
						};
						var handlebars_context = extendHandlebars_context(context_result);
						try {
							compiled_template(handlebars_context);
						} catch (err) {
							config.errors && console.log('ERR template_tag Handlebars.render', template, context, err);
							return callback(err);
						}
						var promises = [];
						_.forEach(_.keys(keys_to_collect), function gatherKeyValues(key) {
							var deferred = when.defer();
							var promise = deferred.promise;
							promises.push(promise);
							var attribute_context = {
								collection: context.collection,
								attribute: key,
								query: { _id: context_result._id}
							};
							return mongoDataInstance.getMongoAttribute(attribute_context, function cacheTemplateKey(err, template_key_result) {
								if (err) {
									config.errors && console.log('ERR handlebar.registerHelper getMongoAttribute', err);
									deferred.reject(err);
								}
								var value = template_key_result[key];
								keys_to_collect[key] = value;
								deferred.resolve(value);
							});
						});
						return when.all(
							promises,
							function onSuccess() {
								var rendered = null;
								try {
									rendered = compiled_template(handlebars_context);
								} catch (err) {
									config.errors && console.log('ERR template_tag Handlebars.render', template, context, err);
									return callback(err);
								}
								config.debug && console.log('// handle markers on rendered template');
								context.query = {_id: context_result._id};
								return getPreviewHTML(rendered, context, function handlePreviewResult(err, preview_html) {
									if (err) {
										config.errors && console.log('ERR template_tag getPreviewHTML', err);
										return callback(err);
									}
									return callback(null, {
										regExp: new RegExp(result, 'gmi'),
										value: preview_html
									});
								});
							},
							function onFailure(err) {
								config.errors && console.log('ERR template_tag resolving promises', err);
								return callback(err);
							}
						)
					});
				});
			}));

		var markdown_tag = 'markdown__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var markdown_regexp = new RegExp(helpers.marker_prefix + markdown_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, markdown_tag, function handleMarkDownMarker(result, callback) {
				var parts = markdown_regexp.exec(result);
				var attribute = {
					collection: parts[1],
					name: parts[2],
					attribute: parts[3],
					query: { name: parts[2] }
				};
				return mongoDataInstance.getMongoAttribute(attribute, function handleMarkdownContent(err, markdown_result) {
					if (err) {
						return callback(err);
					}
					var html = markdown.toHTML(markdown_result[attribute.attribute]);
					return callback(null, {
						regExp: new RegExp(result, 'gmi'),
						value: html
					});
				});
			}));

		var remove_tag = 'remove_([\\w\\W]*?)_end_remove';
		//var remove_regexp = new RegExp(remove_tag);
		promises.push(
			helpers.replace(html, remove_tag, function handleRemoveMarker(result, callback) {
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

