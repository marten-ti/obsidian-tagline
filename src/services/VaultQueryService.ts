import type { App, TFile, TFolder } from 'obsidian';

export interface FileMatch {
	name: string;
	path: string;
}

export function getFilesByFolder(app: App, folderPath: string): FileMatch[] {
	const normalizedPath = folderPath.replace(/\/+$/, '');
	const folder = app.vault.getAbstractFileByPath(normalizedPath);

	if (!folder || !('children' in folder)) {
		return [];
	}

	const results: FileMatch[] = [];
	const children = (folder as TFolder).children;

	for (const child of children) {
		if (child instanceof Object && 'extension' in child && child.extension === 'md') {
			const file = child as TFile;
			results.push({
				name: file.basename,
				path: file.path
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

		// Check inline tags
		const hasInlineTag = cache.tags?.some(
			t => t.tag === tagWithHash || t.tag.startsWith(`${tagWithHash}/`)
		);

		// Check frontmatter tags
		let hasFrontmatterTag = false;
		if (cache.frontmatter?.tags) {
			const fmTags = Array.isArray(cache.frontmatter.tags)
				? cache.frontmatter.tags
				: [cache.frontmatter.tags];
			hasFrontmatterTag = fmTags.some(
				(t: string) => t === tagWithoutHash || t.startsWith(`${tagWithoutHash}/`)
			);
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
