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

export function getTextAfterTag(line: string, tagMatch: TagMatch): string {
	return line.substring(tagMatch.endPos);
}
