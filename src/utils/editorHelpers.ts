import type { Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';

export function getEditorView(editor: Editor): EditorView | null {
	return (editor as any).cm as EditorView ?? null;
}
