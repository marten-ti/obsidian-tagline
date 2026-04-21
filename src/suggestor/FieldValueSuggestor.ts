import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile
} from 'obsidian';
import { EditorView } from '@codemirror/view';
import type InlineTemplateNotesPlugin from '../main';
import { isInsideField, FieldPosition, findNextEmptyField } from '../editor/FieldNavigator';
import { detectConfiguredTagOnLine } from '../parser/TagDetector';
import type { FieldDefinition } from '../types';

interface ValueSuggestionItem {
	displayText: string;
	value: string;
	fieldKey: string;
	fieldPosition: FieldPosition;
}

export class FieldValueSuggestor extends EditorSuggest<ValueSuggestionItem> {
	plugin: InlineTemplateNotesPlugin;

	constructor(plugin: InlineTemplateNotesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);

		const fieldPosition = isInsideField(line, cursor.ch);
		if (!fieldPosition) {
			return null;
		}

		const configuredTags = this.plugin.settings.tagConfigurations.map(c => c.tag);
		const tagMatch = detectConfiguredTagOnLine(line, cursor.ch, configuredTags);
		if (!tagMatch) {
			return null;
		}

		const tagConfig = this.plugin.settings.tagConfigurations.find(c => c.tag === tagMatch.tag);
		if (!tagConfig) {
			return null;
		}

		const fieldDef = tagConfig.fields.find(f => f.key === fieldPosition.key);
		if (!fieldDef || fieldDef.type === 'text') {
			return null;
		}

		return {
			start: { line: cursor.line, ch: fieldPosition.valueStartPos },
			end: { line: cursor.line, ch: fieldPosition.valueEndPos },
			query: `${tagMatch.tag}:${fieldPosition.key}:${fieldPosition.value}`
		};
	}

	getSuggestions(context: EditorSuggestContext): ValueSuggestionItem[] {
		const [tagName, fieldKey, ...valueParts] = context.query.split(':');
		const currentValue = valueParts.join(':');

		if (!tagName || !fieldKey) {
			return [];
		}

		const tagConfig = this.plugin.settings.tagConfigurations.find(c => c.tag === tagName);
		if (!tagConfig) {
			return [];
		}

		const fieldDef = tagConfig.fields.find(f => f.key === fieldKey);
		if (!fieldDef) {
			return [];
		}

		const line = context.editor.getLine(context.start.line);
		const fieldPosition = isInsideField(line, context.start.ch);
		if (!fieldPosition) {
			return [];
		}

		return this.buildSuggestions(fieldDef, fieldPosition, currentValue);
	}

	private buildSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		currentValue: string
	): ValueSuggestionItem[] {
		const suggestions: ValueSuggestionItem[] = [];

		if (fieldDef.type === 'options' && fieldDef.options) {
			for (const option of fieldDef.options) {
				if (currentValue === '' || option.toLowerCase().includes(currentValue.toLowerCase())) {
					suggestions.push({
						displayText: option,
						value: option,
						fieldKey: fieldDef.key,
						fieldPosition
					});
				}
			}
		} else if (fieldDef.type === 'date') {
			const dateSuggestions = this.getDateSuggestions(currentValue);
			for (const ds of dateSuggestions) {
				suggestions.push({
					displayText: ds.display,
					value: ds.value,
					fieldKey: fieldDef.key,
					fieldPosition
				});
			}
		}

		return suggestions;
	}

	private getDateSuggestions(filter: string): { display: string; value: string }[] {
		const today = new Date();
		const suggestions: { display: string; value: string }[] = [];

		const addDays = (date: Date, days: number): Date => {
			const result = new Date(date);
			result.setDate(result.getDate() + days);
			return result;
		};

		const formatDate = (date: Date): string => {
			return date.toISOString().split('T')[0] ?? '';
		};

		const candidates = [
			{ display: `today (${formatDate(today)})`, value: formatDate(today) },
			{ display: `tomorrow (${formatDate(addDays(today, 1))})`, value: formatDate(addDays(today, 1)) },
			{ display: `in 2 days (${formatDate(addDays(today, 2))})`, value: formatDate(addDays(today, 2)) },
			{ display: `in 3 days (${formatDate(addDays(today, 3))})`, value: formatDate(addDays(today, 3)) },
			{ display: `next week (${formatDate(addDays(today, 7))})`, value: formatDate(addDays(today, 7)) },
			{ display: `in 2 weeks (${formatDate(addDays(today, 14))})`, value: formatDate(addDays(today, 14)) }
		];

		for (const c of candidates) {
			if (filter === '' || c.display.toLowerCase().includes(filter.toLowerCase()) || c.value.includes(filter)) {
				suggestions.push(c);
			}
		}

		return suggestions;
	}

	renderSuggestion(suggestion: ValueSuggestionItem, el: HTMLElement): void {
		el.createEl('span', { text: suggestion.displayText });
	}

	selectSuggestion(suggestion: ValueSuggestionItem, _evt: MouseEvent | KeyboardEvent): void {
		const editor = this.context?.editor;
		const context = this.context;
		if (!editor || !context) return;

		const { value } = suggestion;

		// Use CodeMirror 6 transaction API for atomic text insertion + cursor positioning
		const view = (editor as any).cm as EditorView;
		const from = editor.posToOffset(context.start);
		const to = editor.posToOffset(context.end);

		// Build the new line content to find the next empty field
		const currentLine = editor.getLine(context.start.line);
		const newLine = currentLine.substring(0, context.start.ch) + value + currentLine.substring(context.end.ch);
		const insertedValueEnd = context.start.ch + value.length;
		const nextField = findNextEmptyField(newLine, insertedValueEnd);

		// Calculate cursor position: next empty field or end of inserted value
		let cursorOffset: number;
		if (nextField) {
			cursorOffset = editor.posToOffset({ line: context.start.line, ch: nextField.valueStartPos });
		} else {
			cursorOffset = from + value.length;
		}

		this.close();
		view.dispatch({
			changes: { from, to, insert: value },
			selection: { anchor: cursorOffset }
		});
	}
}
