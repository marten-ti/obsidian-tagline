import { App } from 'obsidian';
import { TextInputSuggest } from './TextInputSuggest';

export class TagSuggest extends TextInputSuggest<string> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): string[] {
		const allTags = this.getAllTags();
		const lowerInput = inputStr.toLowerCase();

		const filtered = allTags.filter(tag =>
			tag.toLowerCase().includes(lowerInput)
		);

		return filtered.slice(0, 20);
	}

	private getAllTags(): string[] {
		const tags = new Set<string>();
		const metadataCache = this.app.metadataCache;

		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = metadataCache.getFileCache(file);
			if (cache?.tags) {
				for (const tagCache of cache.tags) {
					const tag = tagCache.tag.replace(/^#/, '');
					tags.add(tag);
				}
			}
			if (cache?.frontmatter?.tags) {
				const fmTags = cache.frontmatter.tags;
				if (Array.isArray(fmTags)) {
					fmTags.forEach(t => tags.add(String(t).replace(/^#/, '')));
				} else if (typeof fmTags === 'string') {
					tags.add(fmTags.replace(/^#/, ''));
				}
			}
		}

		return Array.from(tags).sort();
	}

	renderSuggestion(tag: string, el: HTMLElement): void {
		el.setText(`#${tag}`);
	}

	selectSuggestion(tag: string): void {
		this.inputEl.value = tag;
		this.inputEl.trigger('input');
		this.close();
	}
}
