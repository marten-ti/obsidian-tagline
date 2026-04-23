import { App, TFile } from 'obsidian';
import type { PluginSettings, TagConfiguration } from '../types';
import { findCheckboxLinesLinkingTo, setCheckboxState } from './LinkLineParser';

const DEFAULT_STATUS_FIELD = 'status';
const DEFAULT_COMPLETED_VALUE = 'Done';
const DEFAULT_INCOMPLETE_VALUE = 'To Do';
const GUARD_TIMEOUT_MS = 500;

export class CheckboxSyncService {
	private activeUpdates: Set<string> = new Set();

	constructor(
		private app: App,
		private getSettings: () => PluginSettings
	) {}

	async onCheckboxToggled(linkPath: string, isChecked: boolean, sourcePath: string): Promise<boolean> {
		if (this.activeUpdates.has(linkPath)) {
			return false;
		}

		const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
		if (!file || !(file instanceof TFile)) {
			return false;
		}

		const config = this.getConfigForFile(file);
		if (!config || !config.syncCheckbox) {
			return false;
		}

		const statusField = config.statusField || DEFAULT_STATUS_FIELD;
		const newValue = isChecked
			? (config.completedValue || DEFAULT_COMPLETED_VALUE)
			: (config.incompleteValue || DEFAULT_INCOMPLETE_VALUE);

		this.acquireGuard(linkPath);

		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[statusField] = newValue;
			});
			return true;
		} catch (error) {
			console.error('Failed to update frontmatter:', error);
			return false;
		} finally {
			this.scheduleGuardRelease(linkPath);
		}
	}

	async onFrontmatterChanged(
		childPath: string,
		statusField: string,
		newValue: string,
		config: TagConfiguration
	): Promise<void> {
		if (this.activeUpdates.has(childPath)) {
			return;
		}

		const completedValue = config.completedValue || DEFAULT_COMPLETED_VALUE;
		const incompleteValue = config.incompleteValue || DEFAULT_INCOMPLETE_VALUE;

		let isChecked: boolean | null = null;
		if (newValue === completedValue) {
			isChecked = true;
		} else if (newValue === incompleteValue) {
			isChecked = false;
		}

		if (isChecked === null) {
			return;
		}

		this.acquireGuard(childPath);

		try {
			const parentPaths = this.findParentFiles(childPath);

			for (const parentPath of parentPaths) {
				await this.updateCheckboxesInFile(parentPath, childPath, isChecked);
			}
		} finally {
			this.scheduleGuardRelease(childPath);
		}
	}

	private findParentFiles(childPath: string): string[] {
		const metadataCache = this.app.metadataCache as any;

		if (typeof metadataCache.getBacklinksForFile === 'function') {
			try {
				const backlinks = metadataCache.getBacklinksForFile(childPath);
				if (backlinks && typeof backlinks.keys === 'function') {
					const keys = Array.from(backlinks.keys() as Iterable<string>);
					if (keys.length > 0) {
						return keys;
					}
				}
			} catch {
				// Fall through to manual scan
			}
		}

		const parents: string[] = [];
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const normalizedChildPath = childPath.replace(/\.md$/, '');

		for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
			for (const targetPath of Object.keys(targets)) {
				const normalizedTarget = targetPath.replace(/\.md$/, '');
				if (normalizedTarget === normalizedChildPath ||
					targetPath === childPath ||
					normalizedTarget.endsWith('/' + normalizedChildPath.split('/').pop())) {
					parents.push(sourcePath);
					break;
				}
			}
		}

		return parents;
	}

	private async updateCheckboxesInFile(
		parentPath: string,
		childPath: string,
		isChecked: boolean
	): Promise<void> {
		const parentFile = this.app.vault.getAbstractFileByPath(parentPath);
		if (!parentFile || !(parentFile instanceof TFile)) {
			return;
		}

		const content = await this.app.vault.read(parentFile);
		const lines = content.split('\n');

		const matches = findCheckboxLinesLinkingTo(lines, childPath);
		if (matches.length === 0) {
			return;
		}

		let modified = false;
		for (const match of matches) {
			const currentLine = lines[match.lineIndex];
			if (match.isChecked !== isChecked && currentLine !== undefined) {
				lines[match.lineIndex] = setCheckboxState(currentLine, isChecked);
				modified = true;
			}
		}

		if (modified) {
			await this.app.vault.modify(parentFile, lines.join('\n'));
		}
	}

	private getConfigForFile(file: TFile): TagConfiguration | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		const fileTags = cache.frontmatter.tags || [];
		const normalizedFileTags = Array.isArray(fileTags)
			? fileTags.filter((t): t is string => typeof t === 'string').map(t => t.replace(/^#/, ''))
			: [String(fileTags).replace(/^#/, '')];

		const configs = this.getSettings().tagConfigurations;

		for (const config of configs) {
			if (normalizedFileTags.includes(config.tag)) {
				return config;
			}
		}

		const inlineTags = cache.tags?.map(t => t.tag.replace(/^#/, '')) || [];
		for (const config of configs) {
			if (inlineTags.includes(config.tag)) {
				return config;
			}
		}

		return null;
	}

	private acquireGuard(path: string): void {
		this.activeUpdates.add(path);
	}

	private scheduleGuardRelease(path: string): void {
		setTimeout(() => {
			this.activeUpdates.delete(path);
		}, GUARD_TIMEOUT_MS);
	}
}
