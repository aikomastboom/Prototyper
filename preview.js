var Handlebars = require('handlebars');
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

	var sourceBody =
		'<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>\n' +
			'<script src="//cdnjs.cloudflare.com/ajax/libs/knockout/2.2.1/knockout-min.js"></script>\n' +
			'<script src="//cdnjs.cloudflare.com/ajax/libs/knockout-validation/1.0.2/knockout.validation.min.js"></script>\n' +
			'<script src="//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/2.3.1/js/bootstrap.min.js"></script>\n' +
			'<script src="/content/{{collection}}/{{name}}/behaviour.js"></script>\n';

	var getPreviewHTML = function (options, content, callback) {
		config.debug && console.log('getPreviewHTML',content);
		var html = content;
		var promises = replaceMarkers(options, html);
		when.all(
			promises,
			function onSucces (results) {
				console.log('getPreviewHTML replaceMakers results',results);
				_.forEach(results, function (result) {
					if (result) {
						html = html.replaceAll(result.regExp, result.replacement);
					}
				});
				return callback(null, html);
			},
			function onFailure(err) {
				return callback(err);
			}


		)

	};

	var replaceMarkers = function (options, html) {

		function replace(marker, getReplacement) {
			var deferred = when.defer();
			var regExp = new RegExp('<!--\\s*@@' + marker + '\\s*-->');
			var result = html.match(regExp);
			if (result) {
				getReplacement(result, function (err, replacement) {
					if (err) {
						deferred.reject(err);
					} else {
						deferred.resolve({regExp:regExp, replacement:replacement})
					}
				})
			} else {
				deferred.resolve();
			}
			return deferred.promise;
		}

		console.log('marker options',options);
		var promises = [];
		/* markers:
		    [type]_[collection]_[name]_[attribute]

			script   -> <script src="/content/collection/name/attribute.js"/>
			style    -> <link href="/content/collection/name/attribute.css" media="all" rel="stylesheet" type="text/css">


		 	template_[collection]_[nameX]_[attribute]_context_[collection]_[name]_[attribute]
			template -> put /content/collection/nameX/attribute thru handlebars.. context=collection/name/attribute and include

		    [type]_[collection]_[name]
			script   -> <script src="/content/collection/name.js"/>
				contains all type='script' attributes concatenated based on 'order'
		 	style    -> <link href="/content/collection/name.css" media="all" rel="stylesheet" type="text/css">
			    contains all type='style' attributes concatenated based on 'order'
		 */
//		replace('script_' + options.collection + '_' + options.name + '_' + options.attribute, function (result, callback) {
		promises.push(
			replace('script_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)', function (result, callback) {
				var context = {
					collection: result[0],
					name: result[1],
					attribute: result[2]
				};
				return callback( null,
					'<script src="/content/' + context.collection + '/' + context.name + '/' + context.attribute + '.js"/>\n'
				);
		}));

//		replace('style_' + options.collection + '_' + options.name + '_' + options.attribute, function (result, callback) {
		promises.push(
			replace('style_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)', function (result, callback) {
			var context = {
				collection: result[0],
				name: result[1],
				attribute: result[2]
			};
			return callback( null,
				'<link href="/content/' + context.collection + '/' + context.name + '/' + context.attribute + '.css" media="all" rel="stylesheet" type="text/css">\n'
			);
		}));


//		replace('template_' + options.collection + '_' + options.name + '_' + options.attribute + '_context_', function (result, callback) {
		promises.push(
			replace('template_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_context_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)', function (result, callback) {
				var context = {
					caller_collection: result[0],
					caller_name: result[1],
					caller_attribute: result[2],
					collection: result[3],
					name: result[4],
					attribute: result[5]
				};
				mongodataInstance.getMongoAttribute(options, function (err, result) {
					if (err) {
						return callback(err);
					}
					var template = Handlebars.compile(result[options.attribute]);
					return callback(null, template(context));
				});
		}));

		return promises;
	};


	return {
		getPreviewHTML: getPreviewHTML,
		_replaceMarkers: replaceMarkers
	};
};

