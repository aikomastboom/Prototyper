'use strict';
module.exports = function (dataInstance, previewInstance, importerInstance) {

	function getAttribute(options, callback) {
		return dataInstance.getAttribute(options, callback);
	}

	function getContent(options, callback) {
		return dataInstance.getContent(options, callback);
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
