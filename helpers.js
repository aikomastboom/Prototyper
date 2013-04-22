var when = require('when');
var _ = require('underscore');

var marker_prefix = '<!--\\s*@@';
var marker_postfix = '\\s*-->';

function replace(text, marker, getReplacement, once) {
	var deferred = when.defer();
	var regExp = new RegExp(marker_prefix + marker + marker_postfix, 'gmi');
	var matches = text.match(regExp);
	if (matches) {
		if (once) {
			matches = [matches[0]];
		}
		var match_promises = [];
		_.forEach(matches, function handleMatch(result) {
			var deferred2 = when.defer();
			match_promises.push(deferred2.promise);
			getReplacement(result, function resolveReplacement(err, replacement) {
				if (err) {
					deferred2.reject(err);
				} else {
					var replace_result = {
						regExp: replacement.regExp || regExp,
						replacement: replacement.value
					};
					deferred2.resolve(replace_result)
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
		deferred.resolve({});
	}
	return deferred.promise;
}

function handTextManipulation(text, promises, handler, callback) {
	when.all(
		promises,
		function onSuccess(all_results) {
			_.forEach(all_results, function loopResults(results) {
				_.forEach(results, function handleResult(result) {
					text = handler(text, result);
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
	marker_prefix: marker_prefix,
	marker_postfix: marker_postfix,
	replace: replace,
	handTextManipulation: handTextManipulation
};
