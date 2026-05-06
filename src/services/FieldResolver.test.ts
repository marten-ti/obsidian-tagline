import { describe, it, expect } from 'vitest';
import { getFieldPositions } from '../editor/FieldNavigator';
import { buildFrontmatter } from './NoteCreationService';
import { parseFieldsFromContent } from '../parser/TemplateFrontmatterParser';
import type { FieldDefinition } from '../types';

describe('Integration: line text to frontmatter', () => {
	describe('tags field as list type', () => {
		const templateContent = `---
tags:
- todo
- discuss
status: Not Done # @type: text | options:Not Done,Done
due: # @type: date
context: "" # @type: text | folder:Projects/
discuss-with: "" # @type: text | tag:person
priority: # @type: text | options:high,medium,low
created: <% tp.date.now("YYYY-MM-DD") %> # @type: date
---`;

		it('generates correct YAML array for tags from inline field', () => {
			const lineText = 'mit flo sprechen #discuss [tags:: todo, discuss] [status:: Not Done]';
			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);

			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toContain('tags:');
			expect(frontmatter).toContain('  - todo');
			expect(frontmatter).toContain('  - discuss');
			expect(frontmatter).not.toContain('tags: todo, discuss');
		});

		it('parses tags field as list type from multi-line YAML array', () => {
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const tagsField = fieldDefinitions.find(f => f.key === 'tags');

			expect(tagsField).toBeDefined();
			expect(tagsField?.type).toBe('list');
		});
	});

	describe('full frontmatter generation flow', () => {
		it('generates complete frontmatter from line and template', () => {
			const templateContent = `---
title: "" # @type: text
priority: medium # @type: text | options:high,medium,low
tags: [] # @type: list
assignee: "" # @type: text | tag:person
---`;
			const lineText = 'Review PR #todo [title:: Code Review] [priority:: high] [tags:: urgent, review] [assignee:: [[John]]]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'title: Code Review\n' +
				'priority: high\n' +
				'tags:\n' +
				'  - urgent\n' +
				'  - review\n' +
				'assignee: "[[John]]"\n' +
				'---'
			);
		});

		it('uses default values when inline field is missing', () => {
			const templateContent = `---
status: Not Started # @type: text | options:Not Started,In Progress,Done
priority: medium # @type: text | options:high,medium,low
---`;
			const lineText = 'Task #todo';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'status: Not Started\n' +
				'priority: medium\n' +
				'---'
			);
		});

		it('explicit empty value overrides default', () => {
			const templateContent = `---
status: Not Started # @type: text | options:Not Started,In Progress,Done
---`;
			const lineText = 'Task #todo [status:: ]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'status: \n' +
				'---'
			);
		});

		it('handles wikilinks in list fields', () => {
			const templateContent = `---
attendees: [] # @type: list | tag:person
---`;
			const lineText = 'Meeting #meeting [attendees:: [[Alice]], [[Bob]], [[Charlie]]]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'attendees:\n' +
				'  - "[[Alice]]"\n' +
				'  - "[[Bob]]"\n' +
				'  - "[[Charlie]]"\n' +
				'---'
			);
		});

		it('handles mixed field types correctly', () => {
			const templateContent = `---
title: "" # @type: text
due: # @type: date
completed: false # @type: boolean
tags: [] # @type: list
---`;
			const lineText = '#task [title:: Ship feature] [due:: 2026-04-25] [completed:: true] [tags:: feature, release]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'title: Ship feature\n' +
				'due: 2026-04-25\n' +
				'completed: true\n' +
				'tags:\n' +
				'  - feature\n' +
				'  - release\n' +
				'---'
			);
		});
	});

	describe('edge cases', () => {
		it('handles empty list field as empty value', () => {
			const templateContent = `---
tags: [] # @type: list
---`;
			const lineText = '#todo [tags:: ]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'tags: \n' +
				'---'
			);
		});

		it('handles missing list field as empty array', () => {
			const templateContent = `---
tags: [] # @type: list
---`;
			const lineText = '#todo';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'tags: \n' +
				'---'
			);
		});

		it('handles fields not in template (extra inline fields ignored)', () => {
			const templateContent = `---
title: "" # @type: text
---`;
			const lineText = '#todo [title:: My Task] [extra:: ignored]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'title: My Task\n' +
				'---'
			);
			expect(frontmatter).not.toContain('extra');
		});

		it('handles template fields not in inline (uses defaults)', () => {
			const templateContent = `---
title: "" # @type: text
status: pending # @type: text
---`;
			const lineText = '#todo [title:: My Task]';

			const inlineFields = getFieldPositions(lineText);
			const fieldDefinitions = parseFieldsFromContent(templateContent);
			const frontmatter = buildFrontmatter(inlineFields, fieldDefinitions);

			expect(frontmatter).toBe(
				'---\n' +
				'title: My Task\n' +
				'status: pending\n' +
				'---'
			);
		});
	});
});
