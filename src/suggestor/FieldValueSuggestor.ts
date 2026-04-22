import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile
} from 'obsidian';
import type InlineTemplateNotesPlugin from '../main';
import { isInsideField, FieldPosition, findNextEmptyField } from '../editor/FieldNavigator';
import { detectConfiguredTagOnLine } from '../parser/TagDetector';
import { getEditorView } from '../utils/editorHelpers';
import { addDays, addHours, formatDate, formatDatetime, roundToNextHour } from '../utils/dateHelpers';
import { getFilesByFolder, getFilesByTag } from '../services/VaultQueryService';
import type { FieldDefinition } from '../types';

interface ValueSuggestionItem {
	displayText: string;
	value: string;
	fieldKey: string;
	fieldPosition: FieldPosition;
	isMultiple?: boolean;
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
		const fullValue = valueParts.join(':');

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

		// For multi-select, extract only the text after the last comma for filtering
		let currentValue = fullValue;
		if (fieldDef.multiple) {
			const lastCommaIndex = fullValue.lastIndexOf(',');
			if (lastCommaIndex !== -1) {
				currentValue = fullValue.substring(lastCommaIndex + 1).trim();
			}
		}

		const line = context.editor.getLine(context.start.line);
		const fieldPosition = isInsideField(line, context.start.ch);
		if (!fieldPosition) {
			return [];
		}

		return this.buildSuggestions(fieldDef, fieldPosition, currentValue, fieldDef.multiple);
	}

	private buildSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		currentValue: string,
		isMultiple?: boolean
	): ValueSuggestionItem[] {
		// For multi-select, extract already selected values to exclude them
		const selectedValues = this.getSelectedValues(fieldPosition.value, isMultiple);

		switch (fieldDef.type) {
			case 'options':
				return this.buildOptionsSuggestions(fieldDef, fieldPosition, currentValue);
			case 'date':
				return this.buildDateSuggestions(fieldDef, fieldPosition, currentValue);
			case 'datetime':
				return this.buildDatetimeSuggestions(fieldDef, fieldPosition, currentValue);
			case 'checkbox':
				return this.buildCheckboxSuggestions(fieldDef, fieldPosition, currentValue);
			case 'suggester':
				return this.buildSuggesterSuggestions(fieldDef, fieldPosition, currentValue, selectedValues, isMultiple);
			default:
				return [];
		}
	}

	private getSelectedValues(fieldValue: string, isMultiple?: boolean): Set<string> {
		const selectedValues = new Set<string>();
		if (isMultiple && fieldValue) {
			const linkMatches = fieldValue.matchAll(/\[\[([^\]]+)\]\]/g);
			for (const match of linkMatches) {
				if (match[1]) selectedValues.add(match[1].toLowerCase());
			}
		}
		return selectedValues;
	}

	private buildOptionsSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		currentValue: string
	): ValueSuggestionItem[] {
		if (!fieldDef.options) return [];

		return fieldDef.options
			.filter(option => currentValue === '' || option.toLowerCase().includes(currentValue.toLowerCase()))
			.map(option => ({
				displayText: option,
				value: option,
				fieldKey: fieldDef.key,
				fieldPosition
			}));
	}

	private buildDateSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		filter: string
	): ValueSuggestionItem[] {
		const today = new Date();
		const candidates = [
			{ display: `today (${formatDate(today)})`, value: formatDate(today) },
			{ display: `tomorrow (${formatDate(addDays(today, 1))})`, value: formatDate(addDays(today, 1)) },
			{ display: `in 2 days (${formatDate(addDays(today, 2))})`, value: formatDate(addDays(today, 2)) },
			{ display: `in 3 days (${formatDate(addDays(today, 3))})`, value: formatDate(addDays(today, 3)) },
			{ display: `next week (${formatDate(addDays(today, 7))})`, value: formatDate(addDays(today, 7)) },
			{ display: `in 2 weeks (${formatDate(addDays(today, 14))})`, value: formatDate(addDays(today, 14)) }
		];

		return candidates
			.filter(c => filter === '' || c.display.toLowerCase().includes(filter.toLowerCase()) || c.value.includes(filter))
			.map(c => ({
				displayText: c.display,
				value: c.value,
				fieldKey: fieldDef.key,
				fieldPosition
			}));
	}

	private buildDatetimeSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		filter: string
	): ValueSuggestionItem[] {
		const now = new Date();
		const nextHour = roundToNextHour(now);
		const tomorrow9am = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0), 1);

		const candidates = [
			{ display: `now (${formatDatetime(now)})`, value: formatDatetime(now) },
			{ display: `in 1 hour (${formatDatetime(nextHour)})`, value: formatDatetime(nextHour) },
			{ display: `in 2 hours (${formatDatetime(addHours(nextHour, 1))})`, value: formatDatetime(addHours(nextHour, 1)) },
			{ display: `tomorrow 9am (${formatDatetime(tomorrow9am)})`, value: formatDatetime(tomorrow9am) },
			{ display: `tomorrow 2pm (${formatDatetime(addHours(tomorrow9am, 5))})`, value: formatDatetime(addHours(tomorrow9am, 5)) }
		];

		return candidates
			.filter(c => filter === '' || c.display.toLowerCase().includes(filter.toLowerCase()) || c.value.includes(filter))
			.map(c => ({
				displayText: c.display,
				value: c.value,
				fieldKey: fieldDef.key,
				fieldPosition
			}));
	}

	private buildCheckboxSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		currentValue: string
	): ValueSuggestionItem[] {
		const options = [
			{ display: 'true', value: 'true' },
			{ display: 'false', value: 'false' }
		];

		return options
			.filter(opt => currentValue === '' || opt.display.includes(currentValue.toLowerCase()))
			.map(opt => ({
				displayText: opt.display,
				value: opt.value,
				fieldKey: fieldDef.key,
				fieldPosition
			}));
	}

	private buildSuggesterSuggestions(
		fieldDef: FieldDefinition,
		fieldPosition: FieldPosition,
		filter: string,
		selectedValues: Set<string>,
		isMultiple?: boolean
	): ValueSuggestionItem[] {
		const source = fieldDef.suggesterSource;
		if (!source) return [];

		const files = source.type === 'folder'
			? getFilesByFolder(this.plugin.app, source.value)
			: getFilesByTag(this.plugin.app, source.value);

		return files
			.filter(file => {
				if (isMultiple && selectedValues.has(file.name.toLowerCase())) return false;
				return filter === '' || file.name.toLowerCase().includes(filter.toLowerCase());
			})
			.map(file => ({
				displayText: file.name,
				value: `[[${file.name}]]`,
				fieldKey: fieldDef.key,
				fieldPosition,
				isMultiple
			}));
	}

	renderSuggestion(suggestion: ValueSuggestionItem, el: HTMLElement): void {
		el.createEl('span', { text: suggestion.displayText });
	}

	selectSuggestion(suggestion: ValueSuggestionItem, _evt: MouseEvent | KeyboardEvent): void {
		const editor = this.context?.editor;
		const context = this.context;
		if (!editor || !context) return;

		const { value, isMultiple, fieldPosition } = suggestion;
		const view = getEditorView(editor);
		if (!view) return;

		const from = editor.posToOffset(context.start);
		const to = editor.posToOffset(context.end);

		if (isMultiple) {
			this.insertMultiSelectValue(view, from, to, value, fieldPosition);
		} else {
			this.insertSingleValue(view, editor, context, from, to, value);
		}
	}

	private insertMultiSelectValue(
		view: ReturnType<typeof getEditorView>,
		from: number,
		to: number,
		value: string,
		fieldPosition: FieldPosition
	): void {
		if (!view) return;

		const currentFieldValue = fieldPosition.value.trim();
		const cleanedCurrentValue = currentFieldValue.replace(/,\s*$/, '');
		const newValue = cleanedCurrentValue ? `${cleanedCurrentValue}, ${value}` : value;
		const newValueWithTrailing = newValue + ', ';

		view.dispatch({
			changes: { from, to, insert: newValueWithTrailing },
			selection: { anchor: from + newValueWithTrailing.length }
		});
	}

	private insertSingleValue(
		view: ReturnType<typeof getEditorView>,
		editor: Editor,
		context: EditorSuggestContext,
		from: number,
		to: number,
		value: string
	): void {
		if (!view) return;

		const currentLine = editor.getLine(context.start.line);
		const newLine = currentLine.substring(0, context.start.ch) + value + currentLine.substring(context.end.ch);
		const insertedValueEnd = context.start.ch + value.length;
		const nextField = findNextEmptyField(newLine, insertedValueEnd);

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
