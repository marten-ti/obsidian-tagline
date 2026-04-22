import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type InlineTemplateNotesPlugin from "../main";
import { detectTagsOnLine } from "../parser/TagDetector";
import { getFieldPositions, FieldPosition } from "./FieldNavigator";

class FieldMinimalWidget extends WidgetType {
	private static MAX_VALUE_LENGTH = 30;

	constructor(
		private field: FieldPosition,
		private isFirst: boolean,
		private isLast: boolean
	) {
		super();
	}

	toDOM(): HTMLElement {
		const container = document.createElement("span");
		container.className = "inline-field-minimal";
		if (this.isFirst) container.classList.add("inline-field-minimal--first");
		if (this.isLast) container.classList.add("inline-field-minimal--last");

		const keySpan = document.createElement("span");
		keySpan.className = "inline-field-minimal__key";
		keySpan.textContent = this.field.key + ":";
		container.appendChild(keySpan);

		const valueSpan = document.createElement("span");
		valueSpan.className = "inline-field-minimal__value";

		if (!this.field.value) {
			valueSpan.textContent = " –";
			valueSpan.classList.add("inline-field-minimal__value--empty");
		} else {
			const formattedValue = this.formatValue(this.field.value);
			valueSpan.appendChild(document.createTextNode(" "));
			valueSpan.appendChild(formattedValue);
		}

		container.appendChild(valueSpan);

		if (!this.isLast) {
			const separator = document.createElement("span");
			separator.className = "inline-field-minimal__separator";
			separator.textContent = " │";
			container.appendChild(separator);
		}

		return container;
	}

	private formatValue(value: string): HTMLElement | Text {
		const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
		const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
		const hasWikiLinks = wikiLinkPattern.test(value);
		const hasMarkdownLinks = mdLinkPattern.test(value);

		if (hasWikiLinks || hasMarkdownLinks) {
			return this.formatLinkedValue(value);
		}

		if (value.length > FieldMinimalWidget.MAX_VALUE_LENGTH) {
			const span = document.createElement("span");
			span.className = "inline-field-minimal__value--truncated";
			span.textContent = value.substring(0, FieldMinimalWidget.MAX_VALUE_LENGTH) + "…";
			span.title = value;
			return span;
		}

		return document.createTextNode(value);
	}

	private formatLinkedValue(value: string): HTMLElement {
		const container = document.createElement("span");
		// Combined pattern: wiki links [[path|alias]] or markdown links [text](url)
		const linkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

		let lastIndex = 0;
		let match;
		let linkCount = 0;
		const maxLinks = 3;

		// Count total links for "+X more" display
		const totalLinks = (value.match(/\[\[|\]\(/g) || []).length;

		while ((match = linkPattern.exec(value)) !== null) {
			if (match.index > lastIndex) {
				const textBefore = value.substring(lastIndex, match.index).replace(/^,\s*/, "");
				if (textBefore && linkCount > 0) {
					container.appendChild(document.createTextNode(", "));
				} else if (textBefore) {
					container.appendChild(document.createTextNode(textBefore));
				}
			}

			linkCount++;
			if (linkCount > maxLinks) {
				const remaining = totalLinks - maxLinks;
				const moreSpan = document.createElement("span");
				moreSpan.className = "inline-field-minimal__value--more";
				moreSpan.textContent = ` +${remaining} more`;
				// Build tooltip with all link names
				const allLinks = value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path, alias) => alias || path)
					.replace(/\[([^\]]+)\]\([^)]+\)/g, (_, text) => text);
				moreSpan.title = allLinks;
				container.appendChild(moreSpan);
				break;
			}

			let displayText: string;

			if (match[1] !== undefined) {
				// Wiki link: [[path|alias]] - match[1] is path, match[2] is alias
				const linkPath = match[1];
				const linkAlias = match[2];
				displayText = linkAlias || linkPath?.split("/").pop() || linkPath;
			} else {
				// Markdown link: [text](url) - match[3] is text, match[4] is url
				displayText = match[3] || "";
			}

			if (linkCount > 1) {
				container.appendChild(document.createTextNode(", "));
			}

			const linkSpan = document.createElement("span");
			linkSpan.className = "inline-field-minimal__link";
			linkSpan.textContent = displayText;
			container.appendChild(linkSpan);

			lastIndex = match.index + match[0].length;
		}

		if (linkCount <= maxLinks && lastIndex < value.length) {
			const remaining = value.substring(lastIndex).trim();
			if (remaining && !remaining.match(/^,?\s*$/)) {
				container.appendChild(document.createTextNode(remaining));
			}
		}

		return container;
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

function buildFieldDecorations(view: EditorView, plugin: InlineTemplateNotesPlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	if (!plugin?.settings?.tagConfigurations) {
		return builder.finish();
	}

	const configuredTags = plugin.settings.tagConfigurations.map(c => c.tag);
	if (configuredTags.length === 0) {
		return builder.finish();
	}

	const doc = view.state.doc;
	const decorations: { from: number; to: number; decoration: Decoration }[] = [];

	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		if (!line || line.text.length > 1000) continue;

		const tags = detectTagsOnLine(line.text);
		const matchedTag = tags.find(t => configuredTags.includes(t.tag));
		if (!matchedTag) continue;

		const fields = getFieldPositions(line.text);
		if (fields.length === 0) continue;

		const cursorLine = view.state.doc.lineAt(view.state.selection.main.head);
		const isActiveLine = cursorLine.number === i;

		if (isActiveLine) {
			for (let j = 0; j < fields.length; j++) {
				const field = fields[j];
				if (!field) continue;

				const from = line.from + field.startPos;
				const keyEnd = line.from + field.startPos + 1 + field.key.length;
				const separatorEnd = keyEnd + 3;
				const to = line.from + field.endPos;

				decorations.push({
					from,
					to: keyEnd,
					decoration: Decoration.mark({ class: "inline-field-active__bracket-key" })
				});
				decorations.push({
					from: keyEnd,
					to: separatorEnd,
					decoration: Decoration.mark({ class: "inline-field-active__separator" })
				});
				decorations.push({
					from: separatorEnd,
					to: to - 1,
					decoration: Decoration.mark({
						class: field.value ? "inline-field-active__value" : "inline-field-active__value--empty"
					})
				});
				decorations.push({
					from: to - 1,
					to,
					decoration: Decoration.mark({ class: "inline-field-active__bracket" })
				});
			}
		} else {
			for (let j = 0; j < fields.length; j++) {
				const field = fields[j];
				if (!field) continue;

				const from = line.from + field.startPos;
				const to = line.from + field.endPos;

				const widget = new FieldMinimalWidget(
					field,
					j === 0,
					j === fields.length - 1
				);

				decorations.push({
					from,
					to,
					decoration: Decoration.replace({ widget })
				});
			}
		}
	}

	decorations.sort((a, b) => a.from - b.from);
	for (const d of decorations) {
		builder.add(d.from, d.to, d.decoration);
	}

	return builder.finish();
}

export function createFieldStylerExtension(plugin: InlineTemplateNotesPlugin): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildFieldDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				// Always rebuild - selection changes affect which line shows raw vs styled
				this.decorations = buildFieldDecorations(update.view, plugin);
			}
		},
		{ decorations: (v) => v.decorations }
	);
}
