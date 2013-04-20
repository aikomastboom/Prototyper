var Handlebars = require('handlebars');
var markdown = require('markdown').markdown;
var _ = require('underscore');
var less = require('less');
var when = require('when');
var helpers = require('./helpers.js');

module.exports = function (config, mongodataInstance) {

	var sourceHead =
		'<script src="//cdnjs.cloudflare.com/ajax/libs/modernizr/2.6.2/modernizr.min.js"></script>\n' +
			'{{#if debug}}' +
			'<link href="/content/{{collection}}/{{name}}/style.css" media="all" rel="stylesheet/less" type="text/css">\n' +
			'<script src="//cdnjs.cloudflare.com/ajax/libs/less.js/1.3.3/less.min.js"></script>\n' +
			'{{else}}' +
			'<link href="/content/{{collection}}/{{name}}/style.css" media="all" rel="stylesheet" type="text/css">\n' +
			'{{/if}}';

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

		/* markers:
		 [type]__[collection]_[name]_[attribute]

		 script   -> <script src="/content/collection/name/attribute.js"/>
		 style    -> <link href="/content/collection/name/attribute.css" media="all" rel="stylesheet" type="text/css">


		 markdown__[collection]_[nameX]_[attribute]
		 markdown -> parse /content/collection/name/attribute into html and include

		 template__[collectionX]_[nameX]_[attributeX]__context__[collectionY]_[nameY]
		 template -> put /content/collectionX/nameX/attributeX thru handlebars.. context=collectionY/nameY/attributeY and include

		 remove_.*_end_remove
		 remove_ -> removes markers and everything in between

		 [type]__[collection]_[name]
		 script   -> <script src="/content/collection/name.js"/>
		 contains all type='script' attributes concatenated based on 'order'
		 style    -> <link href="/content/collection/name.css" media="all" rel="stylesheet" type="text/css">
		 contains all type='style' attributes concatenated based on 'order'
		 */
		var promises = [];

		var script_tag = 'script__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var script_regexp = new RegExp(helpers.marker_prefix + script_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, script_tag, function (result, callback) {
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

		var style_tag = 'style__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var style_regexp = new RegExp(helpers.marker_prefix + style_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, style_tag, function (result, callback) {
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

		var template_tag = 'template__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)__context__([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var template_regexp = new RegExp(helpers.marker_prefix + template_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, template_tag, function (result, callback) {
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
				mongodataInstance.getMongoAttribute(template, function (err, attribute_result) {
					if (err) {
						config.errors && console.log('ERR template_tag getMongoAttribute', template, err);
						return callback(err);
					}
					var compiled_template = null;
					try {
						compiled_template = Handlebars.compile(attribute_result[template.attribute]);
					} catch (err) {
						config.errors && console.log('ERR template_tag Handlebars.compile', template, err);
						return callback(err);
					}
					mongodataInstance.getMongoContent(context, function (err, context_result) {
						if (err) {
							config.errors && console.log('ERR template_tag getMongoContent', context);
							return callback(err);
						}
						var rendered = compiled_template(context_result);
						config.debug && console.log('// recurse markers on rendered template');
						context.query = {_id: context_result._id};
						getPreviewHTML(rendered, context, function (err, preview_html) {
							if (err) {
								config.errors && console.log('ERR template_tag getPreviewHTML', err);
								return callback(err);
							}
							return callback(null, {
								regExp: new RegExp(result, 'gmi'),
								value: preview_html
							});
						})
					});
				});
			}));

		var markdown_tag = 'markdown__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
		var markdown_regexp = new RegExp(helpers.marker_prefix + markdown_tag + helpers.marker_postfix);
		promises.push(
			helpers.replace(html, markdown_tag, function (result, callback) {
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

		var remove_tag = 'remove_([\\w\\W]*?)_end_remove';
		//var remove_regexp = new RegExp(remove_tag);
		promises.push(
			helpers.replace(html, remove_tag, function (result, callback) {
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

