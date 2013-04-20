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
		if (err) {
			console.log('ERR responder', options, err)	;
			if (/Data not found*/.test(err.message)) {
				res.status(404);
			}
			return next(err.message);
		}
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
