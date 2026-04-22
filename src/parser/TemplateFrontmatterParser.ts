import type { App, TFile } from 'obsidian';
import type { FieldDefinition, FieldType, SuggesterSource } from '../types';

interface ParsedSuggestHint {
	type: FieldType;
	options?: string[];
	suggesterSource?: SuggesterSource;
	multiple?: boolean;
}

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

	const commentMatch = rest.match(/^(.*?)\s*#\s*@suggest:\s*(.+)$/);

	let yamlValue: string;
	let suggestHint: string | null = null;

	if (commentMatch) {
		yamlValue = (commentMatch[1] ?? '').trim();
		suggestHint = (commentMatch[2] ?? '').trim();
	} else {
		yamlValue = rest.split('#')[0]?.trim() ?? '';
	}

	const defaultValue = parseYamlValue(yamlValue);
	const hint = suggestHint ? parseSuggestHint(suggestHint) : inferTypeFromValue(yamlValue);

	return {
		key,
		type: hint.type,
		...(hint.options && { options: hint.options }),
		...(defaultValue !== undefined && { defaultValue }),
		...(hint.suggesterSource && { suggesterSource: hint.suggesterSource }),
		...(hint.multiple && { multiple: hint.multiple })
	};
}

function parseSuggestHint(hint: string): ParsedSuggestHint {
	const multiple = hint.includes(', multiple');
	const mainHint = hint.replace(/, multiple$/, '').trim();

	if (mainHint === 'text') {
		return { type: 'text' };
	}

	if (mainHint === 'number') {
		return { type: 'number' };
	}

	if (mainHint === 'checkbox') {
		return { type: 'checkbox' };
	}

	if (mainHint === 'date') {
		return { type: 'date' };
	}

	if (mainHint === 'datetime') {
		return { type: 'datetime' };
	}

	if (mainHint.startsWith('options:')) {
		const optionsStr = mainHint.substring('options:'.length);
		const options = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
		return { type: 'options', options };
	}

	if (mainHint.startsWith('tag:')) {
		const tagValue = mainHint.substring('tag:'.length).trim();
		return {
			type: 'suggester',
			suggesterSource: { type: 'tag', value: tagValue },
			multiple
		};
	}

	if (mainHint.startsWith('folder:')) {
		const folderValue = mainHint.substring('folder:'.length).trim();
		return {
			type: 'suggester',
			suggesterSource: { type: 'folder', value: folderValue },
			multiple
		};
	}

	return { type: 'text' };
}

function inferTypeFromValue(yamlValue: string): ParsedSuggestHint {
	if (yamlValue === 'true' || yamlValue === 'false') {
		return { type: 'checkbox' };
	}

	if (/^-?\d+(\.\d+)?$/.test(yamlValue)) {
		return { type: 'number' };
	}

	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(yamlValue)) {
		return { type: 'datetime' };
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(yamlValue)) {
		return { type: 'date' };
	}

	return { type: 'text' };
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
