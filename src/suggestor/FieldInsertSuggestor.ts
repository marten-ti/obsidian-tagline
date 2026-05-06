import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile
} from 'obsidian';
import type InlineTemplateNotesPlugin from '../main';
import { detectConfiguredTagOnLine, TagMatch } from '../parser/TagDetector';
import { getEffectiveFields } from '../services/FieldResolver';
import { getEditorView } from '../utils/editorHelpers';
import type { TagConfiguration, FieldDefinition } from '../types';

interface SuggestionItem {
	type: 'insert-fields';
	displayText: string;
	tagConfig: TagConfiguration;
	tagMatch: TagMatch;
}

export class FieldInsertSuggestor extends EditorSuggest<SuggestionItem> {
	plugin: InlineTemplateNotesPlugin;

	constructor(plugin: InlineTemplateNotesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const configuredTags = this.plugin.settings.tagConfigurations.map(c => c.tag);

		const tagMatch = detectConfiguredTagOnLine(line, cursor.ch, configuredTags);
		if (!tagMatch) {
			return null;
		}

		const textAfterTag = line.substring(tagMatch.endPos, cursor.ch);
		const hasFieldsAlready = line.includes('[') && line.includes(':: ');

		if (hasFieldsAlready) {
			return null;
		}

		if (textAfterTag.trim() === '' || textAfterTag === ' ') {
			return {
				start: { line: cursor.line, ch: tagMatch.endPos },
				end: cursor,
				query: tagMatch.tag
			};
		}

		return null;
	}

	getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
		const tagConfig = this.plugin.settings.tagConfigurations.find(c => c.tag === context.query);
		if (!tagConfig) {
			return [];
		}

		const line = context.editor.getLine(context.start.line);
		const configuredTags = this.plugin.settings.tagConfigurations.map(c => c.tag);
		const tagMatch = detectConfiguredTagOnLine(line, context.end.ch, configuredTags);

		if (!tagMatch) {
			return [];
		}

		return [{
			type: 'insert-fields',
			displayText: `Insert fields for #${tagConfig.tag}`,
			tagConfig,
			tagMatch
		}];
	}

	renderSuggestion(suggestion: SuggestionItem, el: HTMLElement): void {
		el.createEl('span', { text: suggestion.displayText });
	}

	async selectSuggestion(suggestion: SuggestionItem, _evt: MouseEvent | KeyboardEvent): Promise<void> {
		const editor = this.context?.editor;
		const context = this.context;
		if (!editor || !context) return;

		const { tagConfig } = suggestion;

		const fields = await this.getFieldsForConfig(tagConfig);
		if (fields.length === 0) return;

		const fieldStrings = fields.map(field => {
			const defaultVal = field.defaultValue || '';
			return `[${field.key}:: ${defaultVal}]`;
		});
		const fieldsText = ' ' + fieldStrings.join(' ');

		const view = getEditorView(editor);
		if (!view) return;

		const from = editor.posToOffset(context.start);
		const to = editor.posToOffset(context.end);

		// Calculate cursor position inside first field's value area
		// fieldsText format: " [key:: defaultValue] [key2:: ...]"
		// Cursor should be after " [key:: " plus defaultValue length
		let cursorOffset = from + fieldsText.length; // fallback: end of inserted text
		const firstField = fields[0];
		if (firstField) {
			// Position: from + 2 (space + "[") + key.length + 3 (":: ") + defaultValue.length
			cursorOffset = from + 2 + firstField.key.length + 3 + (firstField.defaultValue?.length || 0);
		}

		this.close();
		view.dispatch({
			changes: { from, to, insert: fieldsText },
			selection: { anchor: cursorOffset }
		});
	}

	private async getFieldsForConfig(config: TagConfiguration): Promise<FieldDefinition[]> {
		return getEffectiveFields(this.plugin.app, config);
	}
}
