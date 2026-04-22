import { describe, it, expect } from 'vitest';
import {
	sanitizeFileName,
	formatFrontmatterValue,
	formatMultipleValues,
	buildFrontmatter,
	buildNoteContent,
	stripTemplateFrontmatter
} from './NoteCreationService';
import type { TagConfiguration } from '../types';

describe('sanitizeFileName', () => {
	it('removes backslashes', () => {
		expect(sanitizeFileName('my\\file')).toBe('my-file');
	});

	it('removes forward slashes', () => {
		expect(sanitizeFileName('my/file')).toBe('my-file');
	});

	it('removes colons', () => {
		expect(sanitizeFileName('my:file')).toBe('my-file');
	});

	it('removes asterisks', () => {
		expect(sanitizeFileName('my*file')).toBe('my-file');
	});

	it('removes question marks', () => {
		expect(sanitizeFileName('my?file')).toBe('my-file');
	});

	it('removes quotes', () => {
		expect(sanitizeFileName('my"file')).toBe('my-file');
	});

	it('removes angle brackets', () => {
		expect(sanitizeFileName('my<file>')).toBe('my-file-');
	});

	it('removes pipes', () => {
		expect(sanitizeFileName('my|file')).toBe('my-file');
	});

	it('trims whitespace', () => {
		expect(sanitizeFileName('  my file  ')).toBe('my file');
	});

	it('handles multiple invalid characters', () => {
		expect(sanitizeFileName('my:file/with*invalid?chars')).toBe('my-file-with-invalid-chars');
	});

	it('preserves valid characters', () => {
		expect(sanitizeFileName('my-file_name (1)')).toBe('my-file_name (1)');
	});
});

describe('formatFrontmatterValue', () => {
	it('returns plain value for simple strings', () => {
		expect(formatFrontmatterValue('high')).toBe('high');
	});

	it('quotes wikilinks', () => {
		expect(formatFrontmatterValue('[[People/John]]')).toBe('"[[People/John]]"');
	});

	it('quotes values containing colons', () => {
		expect(formatFrontmatterValue('time: 10:00')).toBe('"time: 10:00"');
	});

	it('quotes values containing hash symbols', () => {
		expect(formatFrontmatterValue('#project')).toBe('"#project"');
	});

	it('returns empty string as-is', () => {
		expect(formatFrontmatterValue('')).toBe('');
	});

	it('handles dates without quoting', () => {
		expect(formatFrontmatterValue('2026-04-21')).toBe('2026-04-21');
	});
});

describe('formatMultipleValues', () => {
	it('splits simple comma-separated values', () => {
		expect(formatMultipleValues('a, b, c')).toEqual(['a', 'b', 'c']);
	});

	it('handles wikilinks with commas inside', () => {
		expect(formatMultipleValues('[[Note, Part 1]], [[Note 2]]')).toEqual([
			'[[Note, Part 1]]',
			'[[Note 2]]'
		]);
	});

	it('trims whitespace from values', () => {
		expect(formatMultipleValues('  a  ,  b  ')).toEqual(['a', 'b']);
	});

	it('handles trailing commas', () => {
		expect(formatMultipleValues('a, b, ')).toEqual(['a', 'b']);
	});

	it('handles empty string', () => {
		expect(formatMultipleValues('')).toEqual([]);
	});

	it('handles single value', () => {
		expect(formatMultipleValues('single')).toEqual(['single']);
	});

	it('handles nested wikilinks', () => {
		expect(formatMultipleValues('[[A]], [[B]], [[C]]')).toEqual([
			'[[A]]',
			'[[B]]',
			'[[C]]'
		]);
	});

	it('handles wikilinks with display text', () => {
		expect(formatMultipleValues('[[Note|Display]], [[Other]]')).toEqual([
			'[[Note|Display]]',
			'[[Other]]'
		]);
	});
});

describe('buildFrontmatter', () => {
	const baseConfig: TagConfiguration = {
		tag: 'todo',
		templatePath: '',
		outputFolder: '',
		fieldSource: 'manual',
		fields: [
			{ key: 'priority', type: 'options', options: ['high', 'medium', 'low'] },
			{ key: 'due', type: 'date' },
			{ key: 'assignee', type: 'text' }
		]
	};

	it('builds frontmatter with field values', () => {
		const fields = [
			{ key: 'priority', value: 'high' },
			{ key: 'due', value: '2026-04-21' },
			{ key: 'assignee', value: 'John' }
		];

		const result = buildFrontmatter(fields, baseConfig);

		expect(result).toBe(
			'---\n' +
			'priority: high\n' +
			'due: 2026-04-21\n' +
			'assignee: John\n' +
			'---'
		);
	});

	it('uses default values when field is missing', () => {
		const configWithDefaults: TagConfiguration = {
			...baseConfig,
			fields: [
				{ key: 'priority', type: 'options', defaultValue: 'medium' },
				{ key: 'status', type: 'text', defaultValue: 'open' }
			]
		};

		const fields = [{ key: 'priority', value: 'high' }];
		const result = buildFrontmatter(fields, configWithDefaults);

		expect(result).toBe(
			'---\n' +
			'priority: high\n' +
			'status: open\n' +
			'---'
		);
	});

	it('uses empty string when no value and no default', () => {
		const fields: { key: string; value: string }[] = [];
		const result = buildFrontmatter(fields, baseConfig);

		expect(result).toBe(
			'---\n' +
			'priority: \n' +
			'due: \n' +
			'assignee: \n' +
			'---'
		);
	});

	it('quotes wikilinks in values', () => {
		const fields = [{ key: 'assignee', value: '[[People/John]]' }];
		const configWithAssignee: TagConfiguration = {
			...baseConfig,
			fields: [{ key: 'assignee', type: 'text' }]
		};

		const result = buildFrontmatter(fields, configWithAssignee);

		expect(result).toBe(
			'---\n' +
			'assignee: "[[People/John]]"\n' +
			'---'
		);
	});

	it('handles empty fields array in config', () => {
		const emptyConfig: TagConfiguration = {
			tag: 'note',
			templatePath: '',
			outputFolder: '',
			fieldSource: 'manual',
			fields: []
		};

		const result = buildFrontmatter([], emptyConfig);

		expect(result).toBe('---\n---');
	});

	it('formats multiple values as YAML array', () => {
		const configWithMultiple: TagConfiguration = {
			tag: 'meeting',
			templatePath: '',
			outputFolder: '',
			fieldSource: 'manual',
			fields: [
				{ key: 'attendees', type: 'suggester', multiple: true }
			]
		};

		const fields = [
			{ key: 'attendees', value: '[[John]], [[Jane]], [[Bob]]' }
		];

		const result = buildFrontmatter(fields, configWithMultiple);

		expect(result).toBe(
			'---\n' +
			'attendees:\n' +
			'  - "[[John]]"\n' +
			'  - "[[Jane]]"\n' +
			'  - "[[Bob]]"\n' +
			'---'
		);
	});

	it('handles multiple values with trailing comma', () => {
		const configWithMultiple: TagConfiguration = {
			tag: 'meeting',
			templatePath: '',
			outputFolder: '',
			fieldSource: 'manual',
			fields: [
				{ key: 'attendees', type: 'suggester', multiple: true }
			]
		};

		const fields = [
			{ key: 'attendees', value: '[[John]], [[Jane]], ' }
		];

		const result = buildFrontmatter(fields, configWithMultiple);

		expect(result).toBe(
			'---\n' +
			'attendees:\n' +
			'  - "[[John]]"\n' +
			'  - "[[Jane]]"\n' +
			'---'
		);
	});
});

describe('buildNoteContent', () => {
	it('combines frontmatter and template content', () => {
		const frontmatter = '---\ntitle: Test\n---';
		const template = '# Template\n\nContent here';

		const result = buildNoteContent(frontmatter, template);

		expect(result).toBe('---\ntitle: Test\n---\n# Template\n\nContent here');
	});

	it('handles empty template', () => {
		const frontmatter = '---\ntitle: Test\n---';

		const result = buildNoteContent(frontmatter, '');

		expect(result).toBe('---\ntitle: Test\n---\n');
	});
});

describe('stripTemplateFrontmatter', () => {
	it('removes frontmatter from content', () => {
		const content = '---\ntitle: Template\ntags: [template]\n---\n# Heading\n\nContent';

		const result = stripTemplateFrontmatter(content);

		expect(result).toBe('# Heading\n\nContent');
	});

	it('returns content unchanged if no frontmatter', () => {
		const content = '# Heading\n\nContent';

		const result = stripTemplateFrontmatter(content);

		expect(result).toBe('# Heading\n\nContent');
	});

	it('handles empty content', () => {
		expect(stripTemplateFrontmatter('')).toBe('');
	});

	it('handles frontmatter only', () => {
		const content = '---\ntitle: Test\n---\n';

		const result = stripTemplateFrontmatter(content);

		expect(result).toBe('');
	});

	it('handles frontmatter without trailing newline', () => {
		const content = '---\ntitle: Test\n---Content';

		const result = stripTemplateFrontmatter(content);

		expect(result).toBe('Content');
	});
});
