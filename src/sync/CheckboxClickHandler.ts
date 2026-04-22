import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, PluginValue } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import type { CheckboxSyncService } from './CheckboxSyncService';
import { extractLinkFromCheckboxLine } from './LinkLineParser';

class CheckboxClickHandler implements PluginValue {
	private readonly view: EditorView;
	private readonly syncService: CheckboxSyncService;

	constructor(view: EditorView, syncService: CheckboxSyncService) {
		this.view = view;
		this.syncService = syncService;
		this.handleClickEvent = this.handleClickEvent.bind(this);
		this.view.dom.addEventListener('click', this.handleClickEvent);
	}

	destroy(): void {
		this.view.dom.removeEventListener('click', this.handleClickEvent);
	}

	private handleClickEvent(event: MouseEvent): void {
		const { target } = event;

		if (!target || !(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
			return;
		}

		const ancestor = target.closest('div.callout-content');
		if (ancestor) {
			return;
		}

		const { state } = this.view;
		const position = this.view.posAtDOM(target);
		const line = state.doc.lineAt(position);

		const parsed = extractLinkFromCheckboxLine(line.text);
		if (!parsed) {
			return;
		}

		const editorInfo = state.field(editorInfoField, false);
		const sourcePath = editorInfo?.file?.path || '';

		const isChecked = target.checked;

		this.syncService.onCheckboxToggled(parsed.linkPath, isChecked, sourcePath);
	}
}

export function createCheckboxSyncExtension(syncService: CheckboxSyncService): Extension {
	return ViewPlugin.define(
		(view) => new CheckboxClickHandler(view, syncService)
	);
}
