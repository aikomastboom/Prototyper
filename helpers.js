var when = require('when');

function replace(text, marker, getReplacement, once) {
	var deferred = when.defer();
	var regExp = new RegExp('<!--\\s*@@' + marker + '\\s*-->', 'gmi');
	var matches = text.match(regExp);
	if (matches) {
		if (once) {
			matches = [matches[0]];
		}
		var match_promises = [];
		_.forEach(matches, function (result) {
			var deferred2 = when.defer();
			match_promises.push(deferred2.promise);
			getReplacement(result, function (err, replacement) {
				if (err) {
					deferred2.reject(err);
				} else {
					deferred2.resolve({regExp: replacement.regExp || regExp, replacement: replacement.value})
				}
			})
		});
		when.all(
			match_promises,
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

function handTextManipulation(text, promises, handler, callback) {
	when.all(
		promises,
		function onSuccess(all_results) {
			_.forEach(all_results, function (results) {
				_.forEach(results, function (result) {
					text = handler( text, result);
				});
			});
			return callback(null, text);
		},
		function onFailure(err) {
			return callback(err);
		}
	)
}

module.exports = {
	replace: replace,
	handTextManipulation: handTextManipulation
};
