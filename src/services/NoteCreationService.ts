import type { TagConfiguration, FieldDefinition } from '../types';

export function sanitizeFileName(title: string): string {
	return title.replace(/[\\/:*?"<>|]/g, '-').trim();
}

export function formatFrontmatterValue(value: string): string {
	if (value.startsWith('[[') && value.endsWith(']]')) {
		return `"${value}"`;
	}
	if (value.includes(':') || value.includes('#')) {
		return `"${value}"`;
	}
	return value;
}

export function formatMultipleValues(value: string): string[] {
	const values: string[] = [];
	let current = '';
	let bracketDepth = 0;

	for (const char of value) {
		if (char === '[') bracketDepth++;
		if (char === ']') bracketDepth--;

		if (char === ',' && bracketDepth === 0) {
			const trimmed = current.trim();
			if (trimmed) values.push(trimmed);
			current = '';
		} else {
			current += char;
		}
	}

	const trimmed = current.trim();
	if (trimmed) values.push(trimmed);

	return values;
}

export function buildFrontmatter(
	fields: { key: string; value: string }[],
	config: TagConfiguration
): string {
	const lines: string[] = ['---'];

	for (const fieldDef of config.fields) {
		const field = fields.find(f => f.key === fieldDef.key);
		const value = field?.value ?? fieldDef.defaultValue ?? '';

		if (fieldDef.type === 'list' && value) {
			const multipleValues = formatMultipleValues(value);
			if (multipleValues.length > 0) {
				lines.push(`${fieldDef.key}:`);
				for (const v of multipleValues) {
					lines.push(`  - ${formatFrontmatterValue(v)}`);
				}
			} else {
				lines.push(`${fieldDef.key}: []`);
			}
		} else {
			lines.push(`${fieldDef.key}: ${formatFrontmatterValue(value)}`);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

export function buildNoteContent(frontmatter: string, templateContent: string): string {
	return frontmatter + '\n' + templateContent;
}

export function stripTemplateFrontmatter(content: string): string {
	return content.replace(/^---[\s\S]*?---\n?/, '');
}
