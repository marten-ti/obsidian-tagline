export interface PluginSettings {
	tagConfigurations: TagConfiguration[];
}

export interface TagConfiguration {
	tag: string;
	templatePath: string;
	outputFolder: string;
	fieldSource: 'manual' | 'template';
	fields: FieldDefinition[];
}

export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'options' | 'suggester';

export interface SuggesterSource {
	type: 'folder' | 'tag';
	value: string;
}

export interface FieldDefinition {
	key: string;
	type: FieldType;
	options?: string[];
	defaultValue?: string;
	suggesterSource?: SuggesterSource;
	multiple?: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	tagConfigurations: []
};
