export interface PluginSettings {
	tagConfigurations: TagConfiguration[];
	openNoteAfterCreation: boolean;
	defaultTemplateFolder: string;
	linkFormat: 'wiki' | 'markdown';
	enableFieldStyling: boolean;
}

export interface TagConfiguration {
	tag: string;
	templatePath: string;
	outputFolder: string;
	fieldSource: 'manual' | 'template';
	fields: FieldDefinition[];
	syncCheckbox?: boolean;
	statusField?: string;
	completedValue?: string;
	incompleteValue?: string;
}

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'list';

export type SuggesterSourceType = 'folder' | 'tag' | 'field' | 'options';

export interface SuggesterSource {
	type: SuggesterSourceType;
	value: string;
}

export interface FieldDefinition {
	key: string;
	type: FieldType;
	defaultValue?: string;
	source?: SuggesterSource;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	tagConfigurations: [],
	openNoteAfterCreation: false,
	defaultTemplateFolder: '',
	linkFormat: 'wiki',
	enableFieldStyling: true
};
