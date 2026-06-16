import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import type TaglinePlugin from "../main";
import { detectTagsOnLine } from "../parser/TagDetector";
import { getFieldPositions, FieldPosition } from "./FieldNavigator";

// =============================================================================
// Hidden fields indicator widget (hiding mode)
// =============================================================================

class HiddenFieldsWidget extends WidgetType {
	constructor(private fieldCount: number) {
		super();
	}

	toDOM(): HTMLElement {
		const el = activeDocument.createElement("span");
		el.className = "inline-field-hidden-indicator";
		el.textContent = "···";
		el.title = `${this.fieldCount} hidden field${this.fieldCount !== 1 ? "s" : ""}`;
		return el;
	}

	eq(other: WidgetType): boolean {
		return other instanceof HiddenFieldsWidget && other.fieldCount === this.fieldCount;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// =============================================================================
// Shared DOM builder
// =============================================================================

const MAX_VALUE_LENGTH = 30;

function buildFieldChip(key: string, value: string, isFirst: boolean): HTMLElement {
	const container = activeDocument.createElement("span");
	container.className = "inline-field-minimal";
	if (isFirst) container.classList.add("inline-field-minimal--first");

	if (!isFirst) {
		const separator = activeDocument.createElement("span");
		separator.className = "inline-field-minimal__separator";
		separator.textContent = "│ ";
		container.appendChild(separator);
	}

	const keySpan = activeDocument.createElement("span");
	keySpan.className = "inline-field-minimal__key";
	keySpan.textContent = key;
	container.appendChild(keySpan);

	const valueSpan = activeDocument.createElement("span");
	valueSpan.className = "inline-field-minimal__value";
	if (!value) {
		valueSpan.textContent = " –";
		valueSpan.classList.add("inline-field-minimal__value--empty");
	} else {
		valueSpan.appendChild(activeDocument.createTextNode(" "));
		valueSpan.appendChild(formatFieldValue(value));
	}
	container.appendChild(valueSpan);
	return container;
}

function formatFieldValue(value: string): HTMLElement | Text {
	const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
	const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	if (wikiLinkPattern.test(value) || mdLinkPattern.test(value)) {
		return formatLinkedValue(value);
	}
	if (value.length > MAX_VALUE_LENGTH) {
		const span = activeDocument.createElement("span");
		span.className = "inline-field-minimal__value--truncated";
		span.textContent = value.substring(0, MAX_VALUE_LENGTH) + "…";
		span.title = value;
		return span;
	}
	return activeDocument.createTextNode(value);
}

function formatLinkedValue(value: string): HTMLElement {
	const container = activeDocument.createElement("span");
	const linkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)/g;
	let lastIndex = 0;
	let match;
	let linkCount = 0;
	const maxLinks = 3;
	const totalLinks = (value.match(/\[\[|\]\(/g) || []).length;

	while ((match = linkPattern.exec(value)) !== null) {
		if (match.index > lastIndex) {
			const textBefore = value.substring(lastIndex, match.index).replace(/^,\s*/, "");
			if (textBefore && linkCount > 0) container.appendChild(activeDocument.createTextNode(", "));
			else if (textBefore) container.appendChild(activeDocument.createTextNode(textBefore));
		}
		linkCount++;
		if (linkCount > maxLinks) {
			const moreSpan = activeDocument.createElement("span");
			moreSpan.className = "inline-field-minimal__value--more";
			moreSpan.textContent = ` +${totalLinks - maxLinks} more`;
			moreSpan.title = value
				.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path: string, alias?: string) => alias || path)
				.replace(/\[([^\]]+)\]\([^)]+\)/g, (_, text: string) => text);
			container.appendChild(moreSpan);
			break;
		}
		let displayText: string;
		if (match[1] !== undefined) {
			displayText = match[2] || match[1]?.split("/").pop() || match[1];
		} else {
			displayText = match[3] || "";
		}
		if (linkCount > 1) container.appendChild(activeDocument.createTextNode(", "));
		const linkSpan = activeDocument.createElement("span");
		linkSpan.className = "inline-field-minimal__link";
		linkSpan.textContent = displayText;
		container.appendChild(linkSpan);
		lastIndex = match.index + match[0].length;
	}

	if (linkCount <= maxLinks && lastIndex < value.length) {
		const remaining = value.substring(lastIndex).trim();
		if (remaining && !remaining.match(/^,?\s*$/)) {
			container.appendChild(activeDocument.createTextNode(remaining));
		}
	}
	return container;
}

// =============================================================================
// CodeMirror ViewPlugin (source mode + live preview)
// =============================================================================

class FieldMinimalWidget extends WidgetType {
	constructor(
		private field: FieldPosition,
		private isFirst: boolean,
		private isLast: boolean
	) {
		super();
	}

	toDOM(): HTMLElement {
		return buildFieldChip(this.field.key, this.field.value, this.isFirst);
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof FieldMinimalWidget &&
			other.field.key === this.field.key &&
			other.field.value === this.field.value &&
			other.field.startPos === this.field.startPos &&
			other.isFirst === this.isFirst &&
			other.isLast === this.isLast
		);
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function buildFieldDecorations(view: EditorView, plugin: TaglinePlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	if (!plugin?.settings?.tagConfigurations) return builder.finish();
	if (!plugin.settings.inlineTagStyle || plugin.settings.inlineTagStyle === 'none') return builder.finish();
	if (!view.state.field(editorLivePreviewField)) return builder.finish();

	const configuredTags = plugin.settings.tagConfigurations.map(c => c.tag);
	if (configuredTags.length === 0) return builder.finish();

	const doc = view.state.doc;
	const decorations: { from: number; to: number; decoration: Decoration }[] = [];

	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		if (!line || line.text.length > 1000) continue;

		const tags = detectTagsOnLine(line.text);
		if (!tags.find(t => configuredTags.includes(t.tag))) continue;

		const fields = getFieldPositions(line.text);
		if (fields.length === 0) continue;

		const isActiveLine = view.state.doc.lineAt(view.state.selection.main.head).number === i;

		if (isActiveLine) {
			const cursorCh = view.state.selection.main.head - line.from;
			// Identify which field (if any) currently contains the cursor — that
			// field is rendered as source (with hidden outer brackets) so the
			// user can edit it. All other fields on the active line render as
			// compact FieldMinimalWidget chips, same as on inactive lines.
			const activeFieldIdx = fields.findIndex(
				f => f && cursorCh >= f.startPos && cursorCh <= f.endPos
			);

			for (let j = 0; j < fields.length; j++) {
				const field = fields[j];
				if (!field) continue;

				if (j === activeFieldIdx) {
					const from = line.from + field.startPos;
					const keyEnd = line.from + field.startPos + 1 + field.key.length;
					const separatorEnd = keyEnd + 3;
					const to = line.from + field.endPos;
					// Hide outer [ and ] via CSS (font-size: 0). Source chars stay in
					// place so the cursor and the field-value suggestor's trigger range
					// are unaffected. Value range is left untouched so Obsidian's native
					// wikilink rendering applies inside the field.
					decorations.push({ from, to: from + 1, decoration: Decoration.mark({ class: "inline-field-active__bracket-hidden" }) });
					decorations.push({ from: from + 1, to: keyEnd, decoration: Decoration.mark({ class: "inline-field-active__key" }) });
					decorations.push({ from: keyEnd, to: separatorEnd, decoration: Decoration.mark({ class: "inline-field-active__separator" }) });
					decorations.push({ from: to - 1, to, decoration: Decoration.mark({ class: "inline-field-active__bracket-hidden" }) });
				} else {
					decorations.push({
						from: line.from + field.startPos,
						to: line.from + field.endPos,
						decoration: Decoration.replace({ widget: new FieldMinimalWidget(field, j === 0, j === fields.length - 1) })
					});
				}
			}
		} else if (plugin.settings.inlineTagStyle === 'hiding') {
			const first = fields[0]!;
			const last = fields[fields.length - 1]!;
			decorations.push({
				from: line.from + first.startPos,
				to: line.from + last.endPos,
				decoration: Decoration.replace({ widget: new HiddenFieldsWidget(fields.length) })
			});
		} else {
			for (let j = 0; j < fields.length; j++) {
				const field = fields[j];
				if (!field) continue;
				decorations.push({
					from: line.from + field.startPos,
					to: line.from + field.endPos,
					decoration: Decoration.replace({ widget: new FieldMinimalWidget(field, j === 0, j === fields.length - 1) })
				});
			}
		}
	}

	decorations.sort((a, b) => a.from - b.from);
	for (const d of decorations) builder.add(d.from, d.to, d.decoration);
	return builder.finish();
}

export function createFieldStylerExtension(plugin: TaglinePlugin): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) { this.decorations = buildFieldDecorations(view, plugin); }
			update(update: ViewUpdate) { this.decorations = buildFieldDecorations(update.view, plugin); }
		},
		{ decorations: (v) => v.decorations }
	);
}
