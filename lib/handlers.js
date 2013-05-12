module.exports = function (mongoDataInstance, previewInstance, importerInstance) {
	"use strict";

	function getAttribute(options, callback) {
		mongoDataInstance.getMongoAttribute(options, callback);
	}

	function getContent(options, callback) {
		mongoDataInstance.getMongoContent(options, callback);
	}

	function getPreviewHTML(html, options, callback) {
		previewInstance.getPreviewHTML(html, options, callback);
	}

	function importer(doc, options, callback) {
		importerInstance.importer(doc, options, callback);
	}

	return {
		getAttribute: getAttribute,
		getContent: getContent,
		getPreviewHTML: getPreviewHTML,
		importer: importer
	};
};
