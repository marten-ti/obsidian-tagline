import { describe, it, expect } from 'vitest';
import {
	detectTagsOnLine,
	detectConfiguredTagOnLine,
	getTextBeforeTag,
	getTextAfterTag,
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
