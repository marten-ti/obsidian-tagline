import { MarkdownView, Plugin } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { isInsideField, findNextField, findPrevField } from './editor/FieldNavigator';
import { InlineTemplateNotesSettingTab } from './settings';
import { FieldInsertSuggestor } from './suggestor/FieldInsertSuggestor';
import { FieldValueSuggestor } from './suggestor/FieldValueSuggestor';
import { DEFAULT_SETTINGS, PluginSettings } from './types';

export default class InlineTemplateNotesPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new InlineTemplateNotesSettingTab(this.app, this));

		this.registerEditorSuggest(new FieldInsertSuggestor(this));
		this.registerEditorSuggest(new FieldValueSuggestor(this));

		// Use DOM-level capture phase to intercept Tab before Obsidian/CodeMirror
		this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
			if (evt.key !== 'Tab') return;

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;

			const editor = activeView.editor;
			const cmView = (editor as any).cm as EditorView;
			if (!cmView) return;

			const pos = cmView.state.selection.main.head;
			const line = cmView.state.doc.lineAt(pos);
			const cursorCh = pos - line.from;

			const currentField = isInsideField(line.text, cursorCh);
			if (!currentField) return;

			evt.preventDefault();
			evt.stopPropagation();

			const targetField = evt.shiftKey
				? findPrevField(line.text, cursorCh)
				: findNextField(line.text, cursorCh);

			if (targetField) {
				const newOffset = line.from + targetField.valueStartPos;
				const isEmpty = targetField.valueStartPos === targetField.valueEndPos;

				cmView.dispatch({
					selection: EditorSelection.cursor(newOffset),
					scrollIntoView: true
				});

				// For empty fields, Obsidian async-shifts cursor +1.
				// Re-assert position after the shift occurs.
				if (isEmpty) {
					const reassert = () => {
						if (cmView.state.selection.main.head !== newOffset) {
							cmView.dispatch({ selection: EditorSelection.cursor(newOffset) });
						}
					};
					// Use multiple RAF to catch it as early as possible
					requestAnimationFrame(() => {
						reassert();
						requestAnimationFrame(reassert);
					});
				}
			}
		}, true); // capture phase

		console.log('Inline Template Notes plugin loaded');
	}

	onunload() {
		console.log('Inline Template Notes plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
