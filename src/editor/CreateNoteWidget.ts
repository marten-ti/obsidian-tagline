import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { setIcon, setTooltip } from "obsidian";
import type InlineTemplateNotesPlugin from "../main";
import { detectTagsOnLine } from "../parser/TagDetector";
import { getFieldPositions } from "./FieldNavigator";

class CreateNoteWidget extends WidgetType {
	constructor(
		private plugin: InlineTemplateNotesPlugin,
		private lineNumber: number,
		private tag: string
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement("span");
		container.className = "inline-template-notes-widget";

		const button = container.createEl("button", {
			cls: "create-note-button",
			attr: { "aria-label": "Create note from template" },
		});
		setTooltip(button, "Create note from template", { placement: "top" });

		const iconSpan = button.createEl("span", { cls: "create-note-button__icon" });
		setIcon(iconSpan, "file-plus");

		button.addEventListener("mousedown", async (e) => {
			e.preventDefault();
			e.stopPropagation();

			const line = view.state.doc.line(this.lineNumber + 1);
			if (!line) return;

			await this.plugin.createNoteFromLine(line.text, this.tag, view, this.lineNumber);
		});

		return container;
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof CreateNoteWidget &&
			other.plugin === this.plugin &&
			other.lineNumber === this.lineNumber &&
			other.tag === this.tag
		);
	}

	get estimatedHeight(): number {
		return -1;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function buildDecorations(view: EditorView, plugin: InlineTemplateNotesPlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	if (!plugin?.settings?.tagConfigurations) {
		return builder.finish();
	}

	const configuredTags = plugin.settings.tagConfigurations.map(c => c.tag);
	if (configuredTags.length === 0) {
		return builder.finish();
	}

	const doc = view.state.doc;

	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		if (!line || line.text.length > 1000) continue;

		const tags = detectTagsOnLine(line.text);
		const fields = getFieldPositions(line.text);

		const matchedTag = tags.find(t => configuredTags.includes(t.tag));
		if (!matchedTag || fields.length === 0) continue;

		const widget = new CreateNoteWidget(plugin, i - 1, matchedTag.tag);
		const decoration = Decoration.widget({ widget, side: 1 });

		builder.add(line.to, line.to, decoration);
	}

	return builder.finish();
}

export function createCreateNoteExtension(plugin: InlineTemplateNotesPlugin): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, plugin);
				}
			}
		},
		{ decorations: (v) => v.decorations }
	);
}
