import { describe, it, expect } from 'vitest';
import {
	detectTagsOnLine,
	detectConfiguredTagOnLine,
	getTextBeforeTag,
	getTextAfterTag,
	extractLinePrefix,
	extractCleanTitle,
	TagMatch,
} from './TagDetector';

describe('detectTagsOnLine', () => {
	describe('basic tag detection', () => {
		it('detects a single tag', () => {
			const tags = detectTagsOnLine('Buy milk #todo');
			expect(tags).toHaveLength(1);
			expect(tags[0]).toMatchObject({
				tag: 'todo',
				startPos: 9,
				endPos: 14,
			});
		});

		it('detects multiple tags', () => {
			const tags = detectTagsOnLine('#project #urgent #todo');
			expect(tags).toHaveLength(3);
			expect(tags.map(t => t.tag)).toEqual(['project', 'urgent', 'todo']);
		});

		it('returns empty array for no tags', () => {
			expect(detectTagsOnLine('no tags here')).toEqual([]);
			expect(detectTagsOnLine('')).toEqual([]);
		});
	});

	describe('tag name formats', () => {
		it('detects nested/hierarchical tags', () => {
			const tags = detectTagsOnLine('#project/sub-task');
			expect(tags).toHaveLength(1);
			expect(tags[0]?.tag).toBe('project/sub-task');
		});

		it('detects tags with underscores', () => {
			const tags = detectTagsOnLine('#my_tag_name');
			expect(tags[0]?.tag).toBe('my_tag_name');
		});

		it('detects tags with numbers', () => {
			const tags = detectTagsOnLine('#task123');
			expect(tags[0]?.tag).toBe('task123');
		});

		it('detects tags with hyphens', () => {
			const tags = detectTagsOnLine('#high-priority');
			expect(tags[0]?.tag).toBe('high-priority');
		});

		it('does not detect tag starting with number', () => {
			const tags = detectTagsOnLine('#123invalid');
			expect(tags).toHaveLength(0);
		});

		it('does not detect lone hash', () => {
			const tags = detectTagsOnLine('# not a tag');
			expect(tags).toHaveLength(0);
		});
	});

	describe('position accuracy', () => {
		it('calculates correct positions for tag at start', () => {
			const tags = detectTagsOnLine('#todo task');
			expect(tags[0]).toMatchObject({
				startPos: 0,
				endPos: 5,
			});
		});

		it('calculates correct positions for tag in middle', () => {
			const tags = detectTagsOnLine('Do this #todo today');
			expect(tags[0]).toMatchObject({
				startPos: 8,
				endPos: 13,
			});
		});

		it('calculates correct positions for tag at end', () => {
			const tags = detectTagsOnLine('Task #todo');
			expect(tags[0]).toMatchObject({
				startPos: 5,
				endPos: 10,
			});
		});
	});
});

describe('detectConfiguredTagOnLine', () => {
	const configuredTags = ['todo', 'project', 'meeting'];

	describe('matching configured tags', () => {
		it('returns match when cursor is after configured tag', () => {
			const result = detectConfiguredTagOnLine('Buy milk #todo ', 15, configuredTags);
			expect(result).not.toBeNull();
			expect(result?.tag).toBe('todo');
		});

		it('returns match when cursor is exactly at tag end', () => {
			const result = detectConfiguredTagOnLine('#todo', 5, configuredTags);
			expect(result?.tag).toBe('todo');
		});

		it('returns first matching tag when multiple configured tags exist', () => {
			const result = detectConfiguredTagOnLine('#todo #project', 14, configuredTags);
			// Both tags match, but todo comes first and cursor is after both
			expect(result?.tag).toBe('todo');
		});
	});

	describe('non-matching cases', () => {
		it('returns null for unconfigured tag', () => {
			expect(detectConfiguredTagOnLine('#unknown', 8, configuredTags)).toBeNull();
		});

		it('returns null when cursor is before tag end', () => {
			expect(detectConfiguredTagOnLine('#todo', 2, configuredTags)).toBeNull();
		});

		it('returns null for line with no tags', () => {
			expect(detectConfiguredTagOnLine('no tags here', 5, configuredTags)).toBeNull();
		});

		it('returns null for empty configured tags list', () => {
			expect(detectConfiguredTagOnLine('#todo', 5, [])).toBeNull();
		});
	});

	describe('cursor position edge cases', () => {
		it('returns null when cursor is at tag start', () => {
			expect(detectConfiguredTagOnLine('#todo', 0, configuredTags)).toBeNull();
		});

		it('returns null when cursor is in middle of tag', () => {
			expect(detectConfiguredTagOnLine('#todo', 3, configuredTags)).toBeNull();
		});

		it('returns match when cursor is one position after tag', () => {
			const result = detectConfiguredTagOnLine('#todo ', 6, configuredTags);
			expect(result?.tag).toBe('todo');
		});
	});
});

describe('getTextBeforeTag', () => {
	it('returns text before tag', () => {
		const tags = detectTagsOnLine('Buy milk #todo');
		const result = getTextBeforeTag('Buy milk #todo', tags[0]!);
		expect(result).toBe('Buy milk');
	});

	it('returns empty string when tag is at start', () => {
		const tags = detectTagsOnLine('#todo Buy milk');
		const result = getTextBeforeTag('#todo Buy milk', tags[0]!);
		expect(result).toBe('');
	});

	it('trims whitespace', () => {
		const tags = detectTagsOnLine('  Some text   #todo');
		const result = getTextBeforeTag('  Some text   #todo', tags[0]!);
		expect(result).toBe('Some text');
	});
});

describe('getTextAfterTag', () => {
	it('returns text after tag', () => {
		const tags = detectTagsOnLine('#todo Buy milk');
		const result = getTextAfterTag('#todo Buy milk', tags[0]!);
		expect(result).toBe(' Buy milk');
	});

	it('returns empty string when tag is at end', () => {
		const tags = detectTagsOnLine('Buy milk #todo');
		const result = getTextAfterTag('Buy milk #todo', tags[0]!);
		expect(result).toBe('');
	});

	it('preserves leading whitespace after tag', () => {
		const tags = detectTagsOnLine('#todo   some text');
		const result = getTextAfterTag('#todo   some text', tags[0]!);
		expect(result).toBe('   some text');
	});
});

describe('real-world scenarios', () => {
	const configuredTags = ['todo', 'meeting', 'project'];

	it('detects todo tag with fields', () => {
		const line = '#todo [prio:: ] [due:: ]';
		const tags = detectTagsOnLine(line);
		expect(tags).toHaveLength(1);
		expect(tags[0]?.tag).toBe('todo');

		// Cursor after tag, before fields
		const match = detectConfiguredTagOnLine(line, 6, configuredTags);
		expect(match?.tag).toBe('todo');
	});

	it('handles task with description and tag', () => {
		const line = 'Review PR for feature X #todo';
		const tags = detectTagsOnLine(line);
		expect(tags[0]?.tag).toBe('todo');
		expect(getTextBeforeTag(line, tags[0]!)).toBe('Review PR for feature X');
	});

	it('handles nested project tags', () => {
		const line = '#project/backend/api Important task';
		const tags = detectTagsOnLine(line);
		expect(tags[0]?.tag).toBe('project/backend/api');
	});
});

describe('extractLinePrefix', () => {
	describe('checkbox tasks', () => {
		it('extracts unchecked checkbox prefix', () => {
			const result = extractLinePrefix('- [ ] todo');
			expect(result.prefix).toBe('- [ ] ');
			expect(result.contentStart).toBe(6);
		});

		it('extracts checked checkbox prefix', () => {
			const result = extractLinePrefix('- [x] completed');
			expect(result.prefix).toBe('- [x] ');
			expect(result.contentStart).toBe(6);
		});

		it('extracts uppercase checked checkbox prefix', () => {
			const result = extractLinePrefix('- [X] completed');
			expect(result.prefix).toBe('- [X] ');
			expect(result.contentStart).toBe(6);
		});

		it('extracts asterisk checkbox prefix', () => {
			const result = extractLinePrefix('* [ ] task');
			expect(result.prefix).toBe('* [ ] ');
			expect(result.contentStart).toBe(6);
		});

		it('extracts numbered checkbox prefix', () => {
			const result = extractLinePrefix('1. [ ] first task');
			expect(result.prefix).toBe('1. [ ] ');
			expect(result.contentStart).toBe(7);
		});
	});

	describe('bullet points', () => {
		it('extracts dash bullet prefix', () => {
			const result = extractLinePrefix('- bullet item');
			expect(result.prefix).toBe('- ');
			expect(result.contentStart).toBe(2);
		});

		it('extracts asterisk bullet prefix', () => {
			const result = extractLinePrefix('* bullet item');
			expect(result.prefix).toBe('* ');
			expect(result.contentStart).toBe(2);
		});

		it('extracts plus bullet prefix', () => {
			const result = extractLinePrefix('+ bullet item');
			expect(result.prefix).toBe('+ ');
			expect(result.contentStart).toBe(2);
		});
	});

	describe('numbered lists', () => {
		it('extracts single digit numbered prefix', () => {
			const result = extractLinePrefix('1. numbered item');
			expect(result.prefix).toBe('1. ');
			expect(result.contentStart).toBe(3);
		});

		it('extracts multi-digit numbered prefix', () => {
			const result = extractLinePrefix('12. numbered item');
			expect(result.prefix).toBe('12. ');
			expect(result.contentStart).toBe(4);
		});
	});

	describe('blockquotes', () => {
		it('extracts single blockquote prefix', () => {
			const result = extractLinePrefix('> quoted text');
			expect(result.prefix).toBe('> ');
			expect(result.contentStart).toBe(2);
		});

		it('extracts nested blockquote prefix', () => {
			const result = extractLinePrefix('> > nested quote');
			expect(result.prefix).toBe('> > ');
			expect(result.contentStart).toBe(4);
		});

		it('extracts deeply nested blockquote prefix', () => {
			const result = extractLinePrefix('> > > deep quote');
			expect(result.prefix).toBe('> > > ');
			expect(result.contentStart).toBe(6);
		});
	});

	describe('indentation', () => {
		it('preserves leading whitespace with checkbox', () => {
			const result = extractLinePrefix('  - [ ] indented task');
			expect(result.prefix).toBe('  - [ ] ');
			expect(result.contentStart).toBe(8);
		});

		it('preserves leading whitespace with bullet', () => {
			const result = extractLinePrefix('    - bullet');
			expect(result.prefix).toBe('    - ');
			expect(result.contentStart).toBe(6);
		});
	});

	describe('no prefix', () => {
		it('returns empty prefix for plain text', () => {
			const result = extractLinePrefix('plain text');
			expect(result.prefix).toBe('');
			expect(result.contentStart).toBe(0);
		});

		it('returns empty prefix for text starting with hash', () => {
			const result = extractLinePrefix('#tag some text');
			expect(result.prefix).toBe('');
			expect(result.contentStart).toBe(0);
		});
	});
});

describe('extractCleanTitle', () => {
	it('extracts title from checkbox line', () => {
		expect(extractCleanTitle('- [ ] todo')).toBe('todo');
	});

	it('extracts title from checked checkbox line', () => {
		expect(extractCleanTitle('- [x] completed task')).toBe('completed task');
	});

	it('extracts title from bullet point', () => {
		expect(extractCleanTitle('- bullet item')).toBe('bullet item');
	});

	it('extracts title from numbered list', () => {
		expect(extractCleanTitle('1. numbered item')).toBe('numbered item');
	});

	it('extracts title from blockquote', () => {
		expect(extractCleanTitle('> quoted text')).toBe('quoted text');
	});

	it('extracts title from nested blockquote', () => {
		expect(extractCleanTitle('> > nested quote')).toBe('nested quote');
	});

	it('extracts title from indented checkbox', () => {
		expect(extractCleanTitle('  - [ ] indented task')).toBe('indented task');
	});

	it('returns plain text unchanged', () => {
		expect(extractCleanTitle('My note title')).toBe('My note title');
	});

	it('trims whitespace from result', () => {
		expect(extractCleanTitle('- [ ]   spaced title  ')).toBe('spaced title');
	});
});
