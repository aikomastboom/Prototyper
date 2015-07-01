'use strict';
module.exports = function (mongoDataInstance, previewInstance, importerInstance) {

	function getAttribute(options, callback) {
		return mongoDataInstance.getMongoAttribute(options, callback);
	}

	function getContent(options, callback) {
		return mongoDataInstance.getMongoContent(options, callback);
	}

	function getPreviewHTML(html, options, callback) {
		return previewInstance.getPreviewHTML(html, options, callback);
	}

	function importer(doc, options, callback) {
		return importerInstance.importer(doc, options, callback);
	}

	return {
		getAttribute:   getAttribute,
		getContent:     getContent,
		getPreviewHTML: getPreviewHTML,
		importer:       importer
	};
};
