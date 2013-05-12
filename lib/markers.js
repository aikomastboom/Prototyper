module.exports = function markers(config) {
	"use strict";

	var marker_prefix = '<!--\\s*@@';
	var marker_postfix = '\\s*-->';

	// Preview markers
	var script_tag = 'script__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var script_regexp = new RegExp(marker_prefix + script_tag + marker_postfix);

	var style_tag = 'style__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var style_regexp = new RegExp(marker_prefix + style_tag + marker_postfix);

	var less_tag = 'less__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var less_regexp = new RegExp(marker_prefix + less_tag + marker_postfix);

	var template_tag = 'template__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)__context__([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var template_regexp = new RegExp(marker_prefix + template_tag + marker_postfix);

	var markdown_tag = 'markdown__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var markdown_regexp = new RegExp(marker_prefix + markdown_tag + marker_postfix);

	var remove_tag = 'remove_([\\w\\W]*?)_end_remove';
	//var remove_regexp = new RegExp(remove_tag);

	// Importer markers
	var import_leftovers_tag = 'import_leftovers__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var import_leftovers_regexp = new RegExp(marker_prefix + import_leftovers_tag + marker_postfix);

	var import_tag = 'import__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_([\\w\\W]*)_end_import__\\1_\\2_\\3';
	var import_regexp = new RegExp(marker_prefix + import_tag + marker_postfix);
	var import_strip_regexp = new RegExp(marker_postfix + '([\\w\\W]*)' + marker_prefix);

	var import_file_tag = 'import_file__([A-Za-z0-9.\/]+)__into__([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)';
	var import_file_regexp = new RegExp(marker_prefix + import_file_tag + marker_postfix);


	function createTag(type, collection, name, attribute) {
		var tag =  '<!-- @@' + type + '__' + collection + '_' + name + '_' + attribute + ' -->';
		if(config.debug) {
			console.log('markers.createTag created:', tag);
		}
	}

	return {
		prefix: marker_prefix,
		postfix: marker_postfix,
		createTag:createTag,
		script_tag:script_tag,
		script_regexp:script_regexp,
		style_tag:style_tag,
		style_regexp:style_regexp,
		less_tag:less_tag,
		less_regexp:less_regexp,
		template_tag:template_tag,
		template_regexp:template_regexp,
		markdown_tag:markdown_tag,
		markdown_regexp:markdown_regexp,
		remove_tag:remove_tag,
//		remove_regexp:remove_regexp,
		import_leftovers_tag:import_leftovers_tag,
		import_leftovers_regexp:import_leftovers_regexp,
		import_tag:import_tag,
		import_regexp:import_regexp,
		import_strip_regexp:import_strip_regexp,
		import_file_tag:import_file_tag,
		import_file_regexp:import_file_regexp
	};
};
