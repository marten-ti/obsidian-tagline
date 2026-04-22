export interface ParsedCheckboxLink {
	linkPath: string;
	displayText: string;
	isChecked: boolean;
	prefix: string;
	linkType: 'wiki' | 'markdown';
}

export interface CheckboxLineMatch {
	lineIndex: number;
	isChecked: boolean;
}

const WIKI_LINK_CHECKBOX_PATTERN = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]\s+\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
const MARKDOWN_LINK_CHECKBOX_PATTERN = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]\s+\[([^\]]+)\]\(([^)]+)\)/;

const BLOCKQUOTE_PREFIX = /^(\s*(?:>\s*)+)/;

export function extractLinkFromCheckboxLine(line: string): ParsedCheckboxLink | null {
	let workingLine = line;
	let blockquotePrefix = '';

	const bqMatch = line.match(BLOCKQUOTE_PREFIX);
	if (bqMatch && bqMatch[1]) {
		blockquotePrefix = bqMatch[1];
		workingLine = line.substring(blockquotePrefix.length);
	}

	const wikiMatch = workingLine.match(WIKI_LINK_CHECKBOX_PATTERN);
	if (wikiMatch) {
		const listPrefix = wikiMatch[1] ?? '';
		const checkChar = wikiMatch[2] ?? ' ';
		const linkPath = wikiMatch[3] ?? '';
		const displayText = wikiMatch[4];
		return {
			linkPath: linkPath,
			displayText: displayText || linkPath,
			isChecked: checkChar.toLowerCase() === 'x',
			prefix: blockquotePrefix + listPrefix,
			linkType: 'wiki'
		};
	}

	const mdMatch = workingLine.match(MARKDOWN_LINK_CHECKBOX_PATTERN);
	if (mdMatch) {
		const listPrefix = mdMatch[1] ?? '';
		const checkChar = mdMatch[2] ?? ' ';
		const displayText = mdMatch[3] ?? '';
		const linkPath = mdMatch[4] ?? '';
		const cleanPath = linkPath.replace(/\.md$/, '');
		return {
			linkPath: cleanPath,
			displayText: displayText,
			isChecked: checkChar.toLowerCase() === 'x',
			prefix: blockquotePrefix + listPrefix,
			linkType: 'markdown'
		};
	}

	return null;
}

export function findCheckboxLinesLinkingTo(
	lines: string[],
	targetPath: string
): CheckboxLineMatch[] {
	const matches: CheckboxLineMatch[] = [];
	const normalizedTarget = targetPath.replace(/\.md$/, '');
	const targetParts = normalizedTarget.split('/');
	const targetFilename = targetParts[targetParts.length - 1] || normalizedTarget;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		const parsed = extractLinkFromCheckboxLine(line);
		if (parsed) {
			const normalizedLink = parsed.linkPath.replace(/\.md$/, '');
			const linkParts = normalizedLink.split('/');
			const linkFilename = linkParts[linkParts.length - 1] || normalizedLink;

			const isMatch =
				normalizedLink === normalizedTarget ||
				normalizedLink.endsWith('/' + normalizedTarget) ||
				normalizedTarget.endsWith('/' + normalizedLink) ||
				linkFilename === targetFilename;

			if (isMatch) {
				matches.push({
					lineIndex: i,
					isChecked: parsed.isChecked
				});
			}
		}
	}

	return matches;
}

export function setCheckboxState(line: string, checked: boolean): string {
	const newCheckChar = checked ? 'x' : ' ';
	return line.replace(/\[([ xX])\]/, `[${newCheckChar}]`);
}

export function normalizeLinkPath(path: string): string {
	return path.replace(/\.md$/, '');
}
