var mimetypes = {
	'js': 'application/javascript',
	'html': 'text/html',
	'md': 'text/html',
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
	return function responder(err, result) {
		if (err) {
			console.log('ERR responder', options, err);
			if (/Data not found*/.test(err.message)) {
				res.status(404);
			}
			return next(JSON.stringify(	err));
		}
		var contentType = getMimeType(options.ext);
		res.setHeader('Content-Type', contentType);
		var content = result;
		if (options.attribute) {
			content = result[options.attribute];
		}
		return res.send(content);
	};
};
