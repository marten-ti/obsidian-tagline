import { MarkdownView, Plugin, TFile, normalizePath } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { isInsideField, findNextField, findPrevField, getFieldPositions } from './editor/FieldNavigator';
import { getEditorView } from './utils/editorHelpers';
import { createCreateNoteExtension } from './editor/CreateNoteWidget';
import { InlineTemplateNotesSettingTab } from './settings';
import { FieldInsertSuggestor } from './suggestor/FieldInsertSuggestor';
import { FieldValueSuggestor } from './suggestor/FieldValueSuggestor';
import { detectTagsOnLine, getTextBeforeTag, extractLinePrefix, extractCleanTitle } from './parser/TagDetector';
import { sanitizeFileName, buildFrontmatter, buildNoteContent, stripTemplateFrontmatter } from './services/NoteCreationService';
import { DEFAULT_SETTINGS, PluginSettings } from './types';
import { CheckboxSyncService } from './sync/CheckboxSyncService';
import { createCheckboxSyncExtension } from './sync/CheckboxClickHandler';
import { FrontmatterWatcher } from './sync/FrontmatterWatcher';

export default class InlineTemplateNotesPlugin extends Plugin {
	settings: PluginSettings;
	private checkboxSyncService: CheckboxSyncService;
	private frontmatterWatcher: FrontmatterWatcher;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new InlineTemplateNotesSettingTab(this.app, this));

		this.registerEditorSuggest(new FieldInsertSuggestor(this));
		this.registerEditorSuggest(new FieldValueSuggestor(this));

		this.registerEditorExtension(createCreateNoteExtension(this));

		this.checkboxSyncService = new CheckboxSyncService(this.app, () => this.settings);
		this.frontmatterWatcher = new FrontmatterWatcher(this.app, this.checkboxSyncService, () => this.settings);
		this.frontmatterWatcher.register(this);
		this.registerEditorExtension(createCheckboxSyncExtension(this.checkboxSyncService));

		this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
			if (evt.key !== 'Tab') return;

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;

			const editor = activeView.editor;
			const cmView = getEditorView(editor);
			if (!cmView) return;

			const pos = cmView.state.selection.main.head;
			const line = cmView.state.doc.lineAt(pos);
			const cursorCh = pos - line.from;

			const currentField = isInsideField(line.text, cursorCh);
			if (!currentField) return;

			evt.preventDefault();
			evt.stopPropagation();

			const targetField = evt.shiftKey
				? findPrevField(line.text, cursorCh)
				: findNextField(line.text, cursorCh);

			if (targetField) {
				const newOffset = line.from + targetField.valueStartPos;
				const isEmpty = targetField.valueStartPos === targetField.valueEndPos;

				cmView.dispatch({
					selection: EditorSelection.cursor(newOffset),
					scrollIntoView: true
				});

				if (isEmpty) {
					const reassert = () => {
						if (cmView.state.selection.main.head !== newOffset) {
							cmView.dispatch({ selection: EditorSelection.cursor(newOffset) });
						}
					};
					requestAnimationFrame(() => {
						reassert();
						requestAnimationFrame(reassert);
					});
				}
			}
		}, true);
	}

	onunload() {
		this.frontmatterWatcher?.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async createNoteFromLine(lineText: string, tagName: string, view: EditorView, lineIndex: number): Promise<void> {
		const config = this.settings.tagConfigurations.find(c => c.tag === tagName);
		if (!config) return;

		const tags = detectTagsOnLine(lineText);
		const tagMatch = tags.find(t => t.tag === tagName);
		if (!tagMatch) return;

		const textBeforeTag = getTextBeforeTag(lineText, tagMatch);
		const { prefix } = extractLinePrefix(lineText);
		const title = extractCleanTitle(textBeforeTag) || 'Untitled';

		const fields = getFieldPositions(lineText);
		const frontmatter = buildFrontmatter(fields, config);
		const templateContent = await this.getTemplateContent(config.templatePath);

		const fileName = sanitizeFileName(title);
		const filePath = config.outputFolder
			? normalizePath(`${config.outputFolder}/${fileName}.md`)
			: normalizePath(`${fileName}.md`);

		const content = buildNoteContent(frontmatter, templateContent);

		if (config.outputFolder) {
			const folderExists = await this.app.vault.adapter.exists(config.outputFolder);
			if (!folderExists) {
				await this.app.vault.createFolder(config.outputFolder);
			}
		}

		const { finalPath, finalFileName } = await this.getUniqueFilePath(filePath, fileName, config.outputFolder);

		const createdFile = await this.createFileWithTemplaterSupport(finalPath, content);

		const line = view.state.doc.line(lineIndex + 1);
		const normalizedFolder = config.outputFolder?.replace(/\/+$/, '');
		const linkPath = normalizedFolder ? `${normalizedFolder}/${finalFileName}` : finalFileName;

		let linkText: string;
		if (this.settings.linkFormat === 'markdown') {
			linkText = `${prefix}[${title}](${linkPath}.md)`;
		} else {
			linkText = `${prefix}[[${linkPath}|${title}]]`;
		}

		view.dispatch({
			changes: { from: line.from, to: line.to, insert: linkText },
		});

		if (this.settings.openNoteAfterCreation) {
			await this.app.workspace.openLinkText(createdFile.path, '', false);
		}
	}

	private async getTemplateContent(templatePath: string): Promise<string> {
		if (!templatePath) return '';

		const file = this.app.vault.getAbstractFileByPath(templatePath);
		if (file instanceof TFile) {
			const content = await this.app.vault.read(file);
			return stripTemplateFrontmatter(content);
		}
		return '';
	}

	private async createFileWithTemplaterSupport(filePath: string, content: string): Promise<TFile> {
		const templaterPlugin = (this.app as any).plugins?.plugins?.['templater-obsidian'];
		const templater = templaterPlugin?.templater;
		const pendingFiles = templater?.files_with_pending_templates as Set<string> | undefined;
		const hasTemplaterSyntax = content.includes('<%');

		// Suppress Templater's auto-trigger by adding to pending files before creation
		const shouldSuppress = hasTemplaterSyntax && pendingFiles instanceof Set;
		if (shouldSuppress) {
			pendingFiles.add(filePath);
		}

		const createdFile = await this.app.vault.create(filePath, content);

		if (shouldSuppress) {
			// Wait for Templater's trigger check to pass (~300ms), then remove from pending
			await new Promise(resolve => setTimeout(resolve, 350));
			pendingFiles.delete(filePath);
		}

		// Process Templater syntax
		if (hasTemplaterSyntax && templater && typeof templater.overwrite_file_commands === 'function') {
			await this.waitForFileSettle(createdFile);
			await templater.overwrite_file_commands.call(templater, createdFile);
		}

		return createdFile;
	}

	private async waitForFileSettle(file: TFile, timeout = 500): Promise<void> {
		const start = Date.now();
		let lastMtime = 0;

		while (Date.now() - start < timeout) {
			const stat = await this.app.vault.adapter.stat(file.path);
			if (stat && stat.mtime === lastMtime) return;
			lastMtime = stat?.mtime ?? 0;
			await new Promise(resolve => setTimeout(resolve, 50));
		}
	}

	private async getUniqueFilePath(
		basePath: string,
		baseFileName: string,
		outputFolder: string
	): Promise<{ finalPath: string; finalFileName: string }> {
		let finalFileName = baseFileName;
		let finalPath = basePath;
		let counter = 1;

		while (await this.app.vault.adapter.exists(finalPath)) {
			finalFileName = `${baseFileName}-${counter}`;
			finalPath = outputFolder
				? normalizePath(`${outputFolder}/${finalFileName}.md`)
				: normalizePath(`${finalFileName}.md`);
			counter++;
		}

		return { finalPath, finalFileName };
	}
}
