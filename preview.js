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
			if (html.match(regExp)){
				html = html.replace(regExp, replacement);
			} else {
				html = html.replace('</head>', '<script>if (typeof window.console !== "undefined"){console.log("WARNING: Missing <!--@@' + marker + '-->");}</script>\n</head>');
			}
		}

		replace(options.collection+'_'+options.name+'_'+'_marker', styleMarkerReplacement);
		replace(options.collection+'_'+options.name+'_'+'_marker', jsMarkerReplacement);

		return html;
	};


	return {
		getCSS: getCSS,
		getJS: getJS,
		getPreviewHTML: getPreviewHTML,
		_replaceMarkers: replaceMarkers
	};
};

