import { App, Plugin, TFile } from 'obsidian';
import type { PluginSettings, TagConfiguration } from '../types';
import type { CheckboxSyncService } from './CheckboxSyncService';

const DEBOUNCE_DELAY_MS = 300;
const DEFAULT_STATUS_FIELD = 'status';

export class FrontmatterWatcher {
	private debouncedHandlers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private previousStatusValues: Map<string, string> = new Map();

	constructor(
		private app: App,
		private syncService: CheckboxSyncService,
		private getSettings: () => PluginSettings
	) {}

	register(plugin: Plugin): void {
		plugin.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleFileChangedDebounced(file);
				}
			})
		);

		plugin.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.previousStatusValues.delete(oldPath);
				}
			})
		);

		plugin.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.previousStatusValues.delete(file.path);
				}
			})
		);
	}

	private handleFileChangedDebounced(file: TFile): void {
		const existingTimeout = this.debouncedHandlers.get(file.path);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		const timeout = setTimeout(() => {
			this.debouncedHandlers.delete(file.path);
			this.handleFileChanged(file);
		}, DEBOUNCE_DELAY_MS);

		this.debouncedHandlers.set(file.path, timeout);
	}

	private handleFileChanged(file: TFile): void {
		const config = this.getConfigForFile(file);
		if (!config || !config.syncCheckbox) {
			return;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return;
		}

		const statusField = config.statusField || DEFAULT_STATUS_FIELD;
		const currentValue = cache.frontmatter[statusField];

		if (currentValue === undefined) {
			return;
		}

		const stringValue = String(currentValue);
		const previousValue = this.previousStatusValues.get(file.path);

		this.previousStatusValues.set(file.path, stringValue);

		if (previousValue === stringValue) {
			return;
		}

		this.syncService.onFrontmatterChanged(file.path, statusField, stringValue, config);
	}

	private getConfigForFile(file: TFile): TagConfiguration | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		const fileTags = cache.frontmatter.tags || [];
		const normalizedFileTags = Array.isArray(fileTags)
			? fileTags.map((t: string) => t.replace(/^#/, ''))
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

	destroy(): void {
		for (const timeout of this.debouncedHandlers.values()) {
			clearTimeout(timeout);
		}
		this.debouncedHandlers.clear();
		this.previousStatusValues.clear();
	}
}
