var Handlebars = require('handlebars');
var _ = require('underscore');
var less = require('less');

module.exports = function (config) {

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

	var templateHead = Handlebars.compile(sourceHead);
	var templateBody = Handlebars.compile(sourceBody);

	var getPreviewHTML = function (options, content, callback) {

		var html = replaceMarkers(options, content, templateHead(options), templateBody(options));

		callback(null, html);
	};

	var replaceMarkers = function (options, html, styleMarkerReplacement, jsMarkerReplacement) {

		function replace(marker, replacement) {
			var regExp = new RegExp('<!--\\s*@@' + marker + '\\s*-->');
			if (html.match(regExp)) {
				html = html.replace(regExp, replacement);
			} else {
				html = html.replace('</head>', '<script>if (typeof window.console !== "undefined"){console.log("WARNING: Missing <!--@@' + marker + '-->");}</script>\n</head>');
			}
		}

		console.log('martker options',options);
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
		replace(options.collection + '_' + options.name + '_' + 'style_marker', styleMarkerReplacement);
		replace(options.collection + '_' + options.name + '_' + 'behaviour_marker', jsMarkerReplacement);

		return html;
	};


	return {
		getPreviewHTML: getPreviewHTML,
		_replaceMarkers: replaceMarkers
	};
};

