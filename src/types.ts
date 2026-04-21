export interface PluginSettings {
	tagConfigurations: TagConfiguration[];
}

export interface TagConfiguration {
	tag: string;
	templatePath: string;
	outputFolder: string;
	fields: FieldDefinition[];
}

export interface FieldDefinition {
	key: string;
	type: 'text' | 'options' | 'date';
	options?: string[];
	defaultValue?: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	tagConfigurations: []
};
