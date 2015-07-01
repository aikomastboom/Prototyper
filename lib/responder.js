'use strict';
/*
* options.ext: determines content-type
* options.attribute: sends result[options.attribute] in stead of result
*/
module.exports = function (config, options, res, next) {
	return function responder(err, result) {
		if (err) {
			config.error && config.error('ERR responder', options, err);
			if (/Data not found*/.test(err.message)) {
				res.status(404);
			}
			return next(err);
		}
		var content = result;
		if (options.attribute) {
			content = result[options.attribute];
		}
		if (options.ext) {
			// Set _Content-Type_ response header with `type` through `mime.lookup()`
			res.type(options.ext);
		} else {
			res.type('text/plain');
		}

		return res.send(content);
	};
};
