import { App, TAbstractFile, TFolder } from 'obsidian';
import { TextInputSuggest } from './TextInputSuggest';

export class FolderSuggest extends TextInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerInput = inputStr.toLowerCase();

		abstractFiles.forEach((file: TAbstractFile) => {
			if (file instanceof TFolder && file.path !== '/') {
				if (file.path.toLowerCase().includes(lowerInput)) {
					folders.push(file);
				}
			}
		});

		return folders.slice(0, 20);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}
}
