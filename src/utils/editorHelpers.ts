import type { Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';

interface EditorWithCm {
	cm?: EditorView;
}

export function getEditorView(editor: Editor): EditorView | null {
	return (editor as unknown as EditorWithCm).cm ?? null;
}
