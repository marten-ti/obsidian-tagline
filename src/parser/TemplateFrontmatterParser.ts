import type { App, TFile } from 'obsidian';
import type { FieldDefinition, FieldType, SuggesterSource } from '../types';

export async function parseTemplateFields(app: App, templatePath: string): Promise<FieldDefinition[]> {
	if (!templatePath) return [];

	const file = app.vault.getAbstractFileByPath(templatePath);
	if (!file) return [];

	const tfile = file as TFile;
	if (!tfile.path.endsWith('.md')) return [];

	const content = await app.vault.read(tfile);
	return parseFieldsFromContent(content);
}

export function parseFieldsFromContent(content: string): FieldDefinition[] {
	const frontmatter = extractFrontmatterWithComments(content);
	if (!frontmatter) return [];

	const fields: FieldDefinition[] = [];
	const lines = frontmatter.split('\n');

	for (const line of lines) {
		const parsed = parseFrontmatterLine(line);
		if (parsed) {
			fields.push(parsed);
		}
	}

	return fields;
}

function extractFrontmatterWithComments(content: string): string | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match?.[1] ?? null;
}

function parseFrontmatterLine(line: string): FieldDefinition | null {
	const keyValueMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
	if (!keyValueMatch) return null;

	const key = keyValueMatch[2];
	const rest = keyValueMatch[3];
	if (!key || rest === undefined) return null;

	const commentMatch = rest.match(/^(.*?)\s*#\s*@type:\s*(.+)$/);

	let yamlValue: string;
	let typeHint: string | null = null;

	if (commentMatch) {
		yamlValue = (commentMatch[1] ?? '').trim();
		typeHint = (commentMatch[2] ?? '').trim();
	} else {
		yamlValue = rest.split('#')[0]?.trim() ?? '';
	}

	const defaultValue = parseYamlValue(yamlValue);

	if (typeHint) {
		const parsed = parseTypeHint(typeHint);
		return {
			key,
			type: parsed.type,
			...(defaultValue !== undefined && { defaultValue }),
			...(parsed.source && { source: parsed.source })
		};
	}

	const inferredType = inferTypeFromValue(yamlValue);
	return {
		key,
		type: inferredType,
		...(defaultValue !== undefined && { defaultValue })
	};
}

interface ParsedTypeHint {
	type: FieldType;
	source?: SuggesterSource;
}

function parseTypeHint(hint: string): ParsedTypeHint {
	const parts = hint.split('|').map(p => p.trim());
	const typePart = parts[0] ?? 'text';

	const type = parseFieldType(typePart);
	const source = parseSource(parts.slice(1));

	return { type, ...(source && { source }) };
}

function parseFieldType(typePart: string): FieldType {
	switch (typePart) {
		case 'text':
			return 'text';
		case 'number':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'date':
			return 'date';
		case 'datetime':
			return 'datetime';
		case 'list':
			return 'list';
		default:
			return 'text';
	}
}

function parseSource(filters: string[]): SuggesterSource | undefined {
	for (const filter of filters) {
		if (filter.startsWith('options:')) {
			return {
				type: 'options',
				value: filter.substring('options:'.length)
			};
		}

		if (filter.startsWith('tag:')) {
			return {
				type: 'tag',
				value: filter.substring('tag:'.length)
			};
		}

		if (filter.startsWith('folder:')) {
			return {
				type: 'folder',
				value: filter.substring('folder:'.length)
			};
		}

		if (filter.startsWith('field:')) {
			return {
				type: 'field',
				value: filter.substring('field:'.length)
			};
		}
	}

	return undefined;
}

function inferTypeFromValue(yamlValue: string): FieldType {
	if (yamlValue === 'true' || yamlValue === 'false') {
		return 'boolean';
	}

	if (/^-?\d+(\.\d+)?$/.test(yamlValue)) {
		return 'number';
	}

	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(yamlValue)) {
		return 'datetime';
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(yamlValue)) {
		return 'date';
	}

	if (yamlValue === '[]') {
		return 'list';
	}

	return 'text';
}

function parseYamlValue(yamlValue: string): string | undefined {
	if (yamlValue === '""' || yamlValue === "''") {
		return '';
	}

	if (yamlValue === '[]') {
		return undefined;
	}

	const quotedMatch = yamlValue.match(/^["'](.*)["']$/);
	if (quotedMatch) {
		return quotedMatch[1];
	}

	if (yamlValue === 'true' || yamlValue === 'false') {
		return yamlValue;
	}

	if (/^-?\d+(\.\d+)?$/.test(yamlValue)) {
		return yamlValue;
	}

	if (yamlValue && !yamlValue.startsWith('[') && !yamlValue.startsWith('{')) {
		return yamlValue;
	}

	return undefined;
}
