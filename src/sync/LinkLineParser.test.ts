import { describe, it, expect } from 'vitest';
import {
	extractLinkFromCheckboxLine,
	findCheckboxLinesLinkingTo,
	setCheckboxState,
	normalizeLinkPath
} from './LinkLineParser';

describe('extractLinkFromCheckboxLine', () => {
	describe('wiki links', () => {
		it('extracts unchecked wiki link with display text', () => {
			const result = extractLinkFromCheckboxLine('- [ ] [[Tasks/todo|My Todo]]');
			expect(result).toEqual({
				linkPath: 'Tasks/todo',
				displayText: 'My Todo',
				isChecked: false,
				prefix: '- ',
				linkType: 'wiki'
			});
		});

		it('extracts checked wiki link with display text', () => {
			const result = extractLinkFromCheckboxLine('- [x] [[Tasks/todo|My Todo]]');
			expect(result).toEqual({
				linkPath: 'Tasks/todo',
				displayText: 'My Todo',
				isChecked: true,
				prefix: '- ',
				linkType: 'wiki'
			});
		});

		it('extracts wiki link without display text', () => {
			const result = extractLinkFromCheckboxLine('- [ ] [[todo]]');
			expect(result).toEqual({
				linkPath: 'todo',
				displayText: 'todo',
				isChecked: false,
				prefix: '- ',
				linkType: 'wiki'
			});
		});

		it('handles uppercase X', () => {
			const result = extractLinkFromCheckboxLine('- [X] [[todo|Todo]]');
			expect(result?.isChecked).toBe(true);
		});
	});

	describe('markdown links', () => {
		it('extracts unchecked markdown link', () => {
			const result = extractLinkFromCheckboxLine('- [ ] [My Todo](Tasks/todo.md)');
			expect(result).toEqual({
				linkPath: 'Tasks/todo',
				displayText: 'My Todo',
				isChecked: false,
				prefix: '- ',
				linkType: 'markdown'
			});
		});

		it('extracts checked markdown link', () => {
			const result = extractLinkFromCheckboxLine('- [x] [Done Task](completed.md)');
			expect(result).toEqual({
				linkPath: 'completed',
				displayText: 'Done Task',
				isChecked: true,
				prefix: '- ',
				linkType: 'markdown'
			});
		});
	});

	describe('list markers', () => {
		it('handles asterisk bullet', () => {
			const result = extractLinkFromCheckboxLine('* [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('* ');
		});

		it('handles plus bullet', () => {
			const result = extractLinkFromCheckboxLine('+ [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('+ ');
		});

		it('handles numbered list', () => {
			const result = extractLinkFromCheckboxLine('1. [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('1. ');
		});

		it('handles multi-digit numbered list', () => {
			const result = extractLinkFromCheckboxLine('12. [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('12. ');
		});
	});

	describe('indentation', () => {
		it('preserves leading whitespace', () => {
			const result = extractLinkFromCheckboxLine('  - [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('  - ');
		});

		it('preserves tab indentation', () => {
			const result = extractLinkFromCheckboxLine('\t- [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('\t- ');
		});
	});

	describe('blockquotes', () => {
		it('handles single blockquote', () => {
			const result = extractLinkFromCheckboxLine('> - [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('> - ');
		});

		it('handles nested blockquotes', () => {
			const result = extractLinkFromCheckboxLine('> > - [ ] [[todo|Todo]]');
			expect(result?.prefix).toBe('> > - ');
		});
	});

	describe('non-matching lines', () => {
		it('returns null for plain text', () => {
			expect(extractLinkFromCheckboxLine('just some text')).toBeNull();
		});

		it('returns null for checkbox without link', () => {
			expect(extractLinkFromCheckboxLine('- [ ] plain task')).toBeNull();
		});

		it('returns null for link without checkbox', () => {
			expect(extractLinkFromCheckboxLine('- [[todo|Todo]]')).toBeNull();
		});

		it('returns null for wiki link in prose', () => {
			expect(extractLinkFromCheckboxLine('See [[todo]] for more')).toBeNull();
		});
	});
});

describe('findCheckboxLinesLinkingTo', () => {
	const testLines = [
		'# Header',
		'- [ ] [[Tasks/todo|My Todo]]',
		'Some text',
		'- [x] [[Tasks/todo|Same Todo]]',
		'- [ ] [[other|Other Note]]',
		'- [ ] [Todo](Tasks/todo.md)',
	];

	it('finds all lines linking to target path', () => {
		const matches = findCheckboxLinesLinkingTo(testLines, 'Tasks/todo');
		expect(matches).toHaveLength(3);
		expect(matches[0]).toEqual({ lineIndex: 1, isChecked: false });
		expect(matches[1]).toEqual({ lineIndex: 3, isChecked: true });
		expect(matches[2]).toEqual({ lineIndex: 5, isChecked: false });
	});

	it('finds lines with .md suffix in target', () => {
		const matches = findCheckboxLinesLinkingTo(testLines, 'Tasks/todo.md');
		expect(matches).toHaveLength(3);
	});

	it('returns empty array when no matches', () => {
		const matches = findCheckboxLinesLinkingTo(testLines, 'nonexistent');
		expect(matches).toHaveLength(0);
	});

	it('matches by filename when full path differs', () => {
		const lines = ['- [ ] [[todo|Todo]]'];
		const matches = findCheckboxLinesLinkingTo(lines, 'Tasks/todo');
		expect(matches).toHaveLength(1);
	});
});

describe('setCheckboxState', () => {
	it('checks an unchecked checkbox', () => {
		const result = setCheckboxState('- [ ] [[todo|Todo]]', true);
		expect(result).toBe('- [x] [[todo|Todo]]');
	});

	it('unchecks a checked checkbox', () => {
		const result = setCheckboxState('- [x] [[todo|Todo]]', false);
		expect(result).toBe('- [ ] [[todo|Todo]]');
	});

	it('handles uppercase X', () => {
		const result = setCheckboxState('- [X] [[todo|Todo]]', false);
		expect(result).toBe('- [ ] [[todo|Todo]]');
	});

	it('preserves rest of line', () => {
		const result = setCheckboxState('  - [ ] [[path/to/note|Display Text]] extra', true);
		expect(result).toBe('  - [x] [[path/to/note|Display Text]] extra');
	});
});

describe('normalizeLinkPath', () => {
	it('removes .md suffix', () => {
		expect(normalizeLinkPath('Tasks/todo.md')).toBe('Tasks/todo');
	});

	it('leaves path without suffix unchanged', () => {
		expect(normalizeLinkPath('Tasks/todo')).toBe('Tasks/todo');
	});
});
