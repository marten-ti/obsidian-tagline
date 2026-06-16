import { TFile, TFolder, type App } from 'obsidian';

export interface FileMatch {
	name: string;
	path: string;
}

export function getFilesByFolder(app: App, folderPath: string): FileMatch[] {
	const normalizedPath = folderPath.replace(/\/+$/, '').replace(/^\/+/, '');

	// Try exact match first
	let folder = app.vault.getAbstractFileByPath(normalizedPath);

	// If not found, try case-insensitive search
	if (!(folder instanceof TFolder)) {
		const allFolders = app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
		folder = allFolders.find(f => f.path.toLowerCase() === normalizedPath.toLowerCase()) ?? null;
	}

	if (!(folder instanceof TFolder)) {
		return [];
	}

	const results: FileMatch[] = [];

	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === 'md') {
			results.push({
				name: child.basename,
				path: child.path
			});
		}
	}

	return results;
}

export function getFilesByTag(app: App, tag: string): FileMatch[] {
	const tagWithHash = tag.startsWith('#') ? tag : `#${tag}`;
	const tagWithoutHash = tag.replace(/^#/, '');
	const files = app.vault.getMarkdownFiles();
	const seen = new Set<string>();
	const results: FileMatch[] = [];

	for (const file of files) {
		if (seen.has(file.basename)) continue;

		const cache = app.metadataCache.getFileCache(file);
		if (!cache) continue;

		const hasInlineTag = cache.tags?.some(
			t => t.tag === tagWithHash || t.tag.startsWith(`${tagWithHash}/`)
		);

		let hasFrontmatterTag = false;
		if (cache.frontmatter?.tags) {
			const fmTagsRaw: unknown = cache.frontmatter.tags;
			const fmTags: unknown[] = Array.isArray(fmTagsRaw) ? fmTagsRaw : [fmTagsRaw];
			hasFrontmatterTag = fmTags.some(t => {
				if (typeof t !== 'string') return false;
				return t === tagWithoutHash || t.startsWith(`${tagWithoutHash}/`);
			});
		}

		if (hasInlineTag || hasFrontmatterTag) {
			seen.add(file.basename);
			results.push({
				name: file.basename,
				path: file.path
			});
		}
	}

	return results;
}

export function getFieldValues(app: App, fieldName: string): string[] {
	const files = app.vault.getMarkdownFiles();
	const values = new Set<string>();

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const value: unknown = cache.frontmatter[fieldName];
		if (value === undefined || value === null) continue;

		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === 'string' && item.trim()) {
					values.add(item.trim());
				}
			}
		} else if (typeof value === 'string' && value.trim()) {
			values.add(value.trim());
		} else if (typeof value === 'number' || typeof value === 'boolean') {
			values.add(String(value));
		}
	}

	return Array.from(values).sort();
}
