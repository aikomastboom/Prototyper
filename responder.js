var mimetypes = {
	'js': 'application/javascript',
	'html': 'text/html',
	'text': 'text/plain',
	'css': 'text/css',
	'less': 'text/css'
};

var getMimeType = function (ext) {
	if (mimetypes[ext]) {
		return  mimetypes[ext];
	}

	return mimetypes.text;
};

module.exports = function (options, res, next) {
	var responder = function (err, result) {
		console.log('err', err);
		if (err) {
			if (/Data not found*/.test(err.message)) {
				res.status(404);
			}
			return next(err.message);
		}
		console.log('responder options', options);
		var contentType = getMimeType(options.ext);
		res.setHeader('Content-Type', contentType);
		var content = result;
		if (options.attribute) {
			content = result[options.attribute];
		}
		res.send(content);
	};
	return responder;
};
