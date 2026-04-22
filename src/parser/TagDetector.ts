export interface TagMatch {
	tag: string;
	startPos: number;
	endPos: number;
}

const TAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

export function detectTagsOnLine(line: string): TagMatch[] {
	const matches: TagMatch[] = [];

	for (const match of line.matchAll(TAG_PATTERN)) {
		const tagName = match[1];
		if (tagName) {
			matches.push({
				tag: tagName,
				startPos: match.index!,
				endPos: match.index! + match[0].length
			});
		}
	}

	return matches;
}

export function detectConfiguredTagOnLine(
	line: string,
	cursorCh: number,
	configuredTags: string[]
): TagMatch | null {
	const matches = detectTagsOnLine(line);

	for (const match of matches) {
		if (configuredTags.includes(match.tag) && cursorCh >= match.endPos) {
			return match;
		}
	}

	return null;
}

export function getTextBeforeTag(line: string, tagMatch: TagMatch): string {
	return line.substring(0, tagMatch.startPos).trim();
}

export interface LinePrefix {
	prefix: string;
	contentStart: number;
}

export function extractLinePrefix(line: string): LinePrefix {
	// First, handle blockquotes (possibly nested like "> > > ")
	let blockquotePrefix = '';
	let remaining = line;
	let match = remaining.match(/^(\s*>\s*)/);
	while (match && match[1]) {
		blockquotePrefix += match[1];
		remaining = remaining.substring(match[1].length);
		match = remaining.match(/^(\s*>\s*)/);
	}

	// After stripping blockquotes, check for list markers + optional checkbox
	// Patterns: "- [ ] ", "- [x] ", "- ", "* ", "+ ", "1. ", etc.
	const listMatch = remaining.match(/^(\s*(?:[-*+]|\d+\.)\s+(?:\[[^\]]\]\s+)?)/);

	if (listMatch) {
		return {
			prefix: blockquotePrefix + listMatch[0],
			contentStart: blockquotePrefix.length + listMatch[0].length
		};
	}

	// If we found blockquotes but no list marker, return the blockquote prefix
	if (blockquotePrefix) {
		return {
			prefix: blockquotePrefix,
			contentStart: blockquotePrefix.length
		};
	}

	return { prefix: '', contentStart: 0 };
}

export function extractCleanTitle(textBeforeTag: string): string {
	const { contentStart } = extractLinePrefix(textBeforeTag);
	return textBeforeTag.substring(contentStart).trim();
}

export function getTextAfterTag(line: string, tagMatch: TagMatch): string {
	return line.substring(tagMatch.endPos);
}
