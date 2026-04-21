import type { TagConfiguration } from '../types';

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

export function buildFrontmatter(
	fields: { key: string; value: string }[],
	config: TagConfiguration
): string {
	const lines: string[] = ['---'];

	for (const fieldDef of config.fields) {
		const field = fields.find(f => f.key === fieldDef.key);
		const value = field?.value ?? fieldDef.defaultValue ?? '';
		lines.push(`${fieldDef.key}: ${formatFrontmatterValue(value)}`);
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
