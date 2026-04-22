import { App, TAbstractFile, TFile } from 'obsidian';
import { TextInputSuggest } from './TextInputSuggest';

export class FileSuggest extends TextInputSuggest<TFile> {
	private extension: string | null;
	private folderFilter: string | null;

	constructor(app: App, inputEl: HTMLInputElement, extension: string | null = '.md', folderFilter: string | null = null) {
		super(app, inputEl);
		this.extension = extension;
		this.folderFilter = folderFilter;
	}

	setFolderFilter(folder: string | null): void {
		this.folderFilter = folder;
	}

	getSuggestions(inputStr: string): TFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const files: TFile[] = [];
		const lowerInput = inputStr.toLowerCase();

		abstractFiles.forEach((file: TAbstractFile) => {
			if (!(file instanceof TFile)) return;

			if (this.extension && !file.path.endsWith(this.extension)) return;

			if (this.folderFilter) {
				const normalizedFilter = this.folderFilter.replace(/\/$/, '');
				if (!file.path.startsWith(normalizedFilter + '/') && !file.path.startsWith(normalizedFilter)) return;
			}

			if (file.path.toLowerCase().includes(lowerInput)) {
				files.push(file);
			}
		});

		return files.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger('input');
		this.close();
	}
}
