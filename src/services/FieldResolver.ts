import type { App } from 'obsidian';
import type { TagConfiguration, FieldDefinition } from '../types';
import { parseTemplateFields } from '../parser/TemplateFrontmatterParser';

export async function getEffectiveFields(
	app: App,
	config: TagConfiguration
): Promise<FieldDefinition[]> {
	if (config.fieldSource === 'template' && config.templatePath) {
		return parseTemplateFields(app, config.templatePath);
	}
	return config.fields;
}
