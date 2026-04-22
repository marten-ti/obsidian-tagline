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

	it('parses basic text field', () => {
		const content = '---\ntitle: ""\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields).toHaveLength(1);
		expect(fields[0]).toEqual({
			key: 'title',
			type: 'text',
			defaultValue: ''
		});
	});

	it('parses text field with default value', () => {
		const content = '---\nstatus: draft\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'status',
			type: 'text',
			defaultValue: 'draft'
		});
	});

	it('parses @suggest: date hint', () => {
		const content = '---\ndue: ""  # @suggest: date\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'due',
			type: 'date',
			defaultValue: ''
		});
	});

	it('parses @suggest: datetime hint', () => {
		const content = '---\nscheduled: ""  # @suggest: datetime\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'scheduled',
			type: 'datetime',
			defaultValue: ''
		});
	});

	it('parses @suggest: number hint', () => {
		const content = '---\nwordCount: 0  # @suggest: number\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'wordCount',
			type: 'number',
			defaultValue: '0'
		});
	});

	it('parses @suggest: checkbox hint', () => {
		const content = '---\ncompleted: false  # @suggest: checkbox\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'completed',
			type: 'checkbox',
			defaultValue: 'false'
		});
	});

	it('parses @suggest: options hint', () => {
		const content = '---\npriority: medium  # @suggest: options:high,medium,low\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'priority',
			type: 'options',
			options: ['high', 'medium', 'low'],
			defaultValue: 'medium'
		});
	});

	it('parses @suggest: tag hint', () => {
		const content = '---\nassignee: ""  # @suggest: tag:person\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'assignee',
			type: 'suggester',
			suggesterSource: { type: 'tag', value: 'person' },
			defaultValue: ''
		});
	});

	it('parses @suggest: folder hint', () => {
		const content = '---\ncontext: ""  # @suggest: folder:Projects/\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'context',
			type: 'suggester',
			suggesterSource: { type: 'folder', value: 'Projects/' },
			defaultValue: ''
		});
	});

	it('parses @suggest: tag with multiple flag', () => {
		const content = '---\nattendees: []  # @suggest: tag:person, multiple\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]).toEqual({
			key: 'attendees',
			type: 'suggester',
			suggesterSource: { type: 'tag', value: 'person' },
			multiple: true
		});
	});

	it('infers checkbox type from boolean value', () => {
		const content = '---\ndone: false\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]?.type).toBe('checkbox');
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

	it('parses multiple fields', () => {
		const content = `---
title: ""
priority: medium  # @suggest: options:high,medium,low
due: ""  # @suggest: date
assignee: ""  # @suggest: tag:person
---`;
		const fields = parseFieldsFromContent(content);
		expect(fields).toHaveLength(4);
		expect(fields.map(f => f.key)).toEqual(['title', 'priority', 'due', 'assignee']);
	});

	it('handles quoted string values', () => {
		const content = '---\ntitle: "My Title"\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields[0]?.defaultValue).toBe('My Title');
	});

	it('handles single-quoted string values', () => {
		const content = "---\ntitle: 'My Title'\n---";
		const fields = parseFieldsFromContent(content);
		expect(fields[0]?.defaultValue).toBe('My Title');
	});

	it('ignores non-property lines', () => {
		const content = '---\n# This is a comment\ntitle: ""\n---';
		const fields = parseFieldsFromContent(content);
		expect(fields).toHaveLength(1);
		expect(fields[0]?.key).toBe('title');
	});
});
