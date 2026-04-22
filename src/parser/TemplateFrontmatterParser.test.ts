import { describe, it, expect } from 'vitest';
import { parseFieldsFromContent } from './TemplateFrontmatterParser';

describe('parseFieldsFromContent', () => {
	it('returns empty array for content without frontmatter', () => {
		const content = 'Just regular markdown content';
		expect(parseFieldsFromContent(content)).toEqual([]);
	});

	it('returns empty array for empty frontmatter', () => {
		const content = '---\n---\nContent';
		expect(parseFieldsFromContent(content)).toEqual([]);
	});

	describe('scalar types', () => {
		it('parses @type: text', () => {
			const content = '---\ntitle: ""  # @type: text\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields).toHaveLength(1);
			expect(fields[0]).toEqual({
				key: 'title',
				type: 'text',
				defaultValue: ''
			});
		});

		it('parses @type: number', () => {
			const content = '---\nestimate: 8  # @type: number\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'estimate',
				type: 'number',
				defaultValue: '8'
			});
		});

		it('parses @type: boolean', () => {
			const content = '---\ncompleted: true  # @type: boolean\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'completed',
				type: 'boolean',
				defaultValue: 'true'
			});
		});

		it('parses @type: date', () => {
			const content = '---\ndue: ""  # @type: date\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'due',
				type: 'date',
				defaultValue: ''
			});
		});

		it('parses @type: datetime', () => {
			const content = '---\nscheduled: ""  # @type: datetime\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'scheduled',
				type: 'datetime',
				defaultValue: ''
			});
		});
	});

	describe('list type', () => {
		it('parses @type: list', () => {
			const content = '---\ntags: []  # @type: list\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'tags',
				type: 'list'
			});
		});

		it('parses @type: list with options source', () => {
			const content = '---\ntags: []  # @type: list | options:urgent,important,someday\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'tags',
				type: 'list',
				source: { type: 'options', value: 'urgent,important,someday' }
			});
		});

		it('parses @type: list with tag source', () => {
			const content = '---\nattendees: []  # @type: list | tag:person\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'attendees',
				type: 'list',
				source: { type: 'tag', value: 'person' }
			});
		});

		it('parses @type: list with folder source', () => {
			const content = '---\nprojects: []  # @type: list | folder:Projects/\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'projects',
				type: 'list',
				source: { type: 'folder', value: 'Projects/' }
			});
		});
	});

	describe('source filters', () => {
		it('parses options source', () => {
			const content = '---\npriority: "medium"  # @type: text | options:high,medium,low\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'priority',
				type: 'text',
				defaultValue: 'medium',
				source: { type: 'options', value: 'high,medium,low' }
			});
		});

		it('parses tag source', () => {
			const content = '---\nassignee: ""  # @type: text | tag:person\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'assignee',
				type: 'text',
				defaultValue: '',
				source: { type: 'tag', value: 'person' }
			});
		});

		it('parses folder source', () => {
			const content = '---\nproject: ""  # @type: text | folder:Projects/\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'project',
				type: 'text',
				defaultValue: '',
				source: { type: 'folder', value: 'Projects/' }
			});
		});

		it('parses field source', () => {
			const content = '---\nstatus: "To Do"  # @type: text | field:status\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]).toEqual({
				key: 'status',
				type: 'text',
				defaultValue: 'To Do',
				source: { type: 'field', value: 'status' }
			});
		});
	});

	describe('type inference', () => {
		it('infers boolean type from true/false value', () => {
			const content = '---\ndone: false\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('boolean');
		});

		it('infers number type from numeric value', () => {
			const content = '---\ncount: 42\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('number');
		});

		it('infers date type from date-formatted value', () => {
			const content = '---\ncreated: 2026-04-21\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('date');
		});

		it('infers datetime type from datetime-formatted value', () => {
			const content = '---\nscheduled: 2026-04-21T14:30\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('datetime');
		});

		it('infers list type from empty array', () => {
			const content = '---\nitems: []\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('list');
		});

		it('infers text type for plain strings', () => {
			const content = '---\ntitle: "Hello"\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.type).toBe('text');
		});
	});

	describe('default values', () => {
		it('parses empty string default', () => {
			const content = '---\ntitle: ""\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('');
		});

		it('parses quoted string default', () => {
			const content = '---\nstatus: "In Progress"\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('In Progress');
		});

		it('parses single-quoted string default', () => {
			const content = "---\nstatus: 'In Progress'\n---";
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('In Progress');
		});

		it('parses unquoted string default', () => {
			const content = '---\nstatus: draft\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('draft');
		});

		it('parses number default', () => {
			const content = '---\ncount: 42\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('42');
		});

		it('parses boolean default', () => {
			const content = '---\ncompleted: true\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBe('true');
		});

		it('does not set default for empty array', () => {
			const content = '---\nitems: []\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.defaultValue).toBeUndefined();
		});
	});

	describe('multiple fields', () => {
		it('parses multiple fields correctly', () => {
			const content = `---
title: ""  # @type: text
priority: "medium"  # @type: text | options:high,medium,low
due: ""  # @type: date
assignee: ""  # @type: text | tag:person
tags: []  # @type: list | options:urgent,important
---`;
			const fields = parseFieldsFromContent(content);
			expect(fields).toHaveLength(5);
			expect(fields.map(f => f.key)).toEqual(['title', 'priority', 'due', 'assignee', 'tags']);
			expect(fields[1]?.source).toEqual({ type: 'options', value: 'high,medium,low' });
			expect(fields[3]?.source).toEqual({ type: 'tag', value: 'person' });
			expect(fields[4]?.type).toBe('list');
		});
	});

	describe('edge cases', () => {
		it('ignores comment-only lines', () => {
			const content = '---\n# This is a comment\ntitle: ""\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields).toHaveLength(1);
			expect(fields[0]?.key).toBe('title');
		});

		it('handles whitespace in pipe-delimited filters', () => {
			const content = '---\npriority: ""  # @type: text | options:high,medium,low\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.source).toEqual({ type: 'options', value: 'high,medium,low' });
		});

		it('handles folder paths with trailing slash', () => {
			const content = '---\nproject: ""  # @type: text | folder:Projects/Active/\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.source).toEqual({ type: 'folder', value: 'Projects/Active/' });
		});

		it('takes first matching source when multiple provided', () => {
			const content = '---\nitem: ""  # @type: text | tag:person | folder:People/\n---';
			const fields = parseFieldsFromContent(content);
			expect(fields[0]?.source).toEqual({ type: 'tag', value: 'person' });
		});
	});
});
