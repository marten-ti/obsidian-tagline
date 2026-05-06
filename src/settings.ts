import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaglinePlugin from './main';
import type { TagConfiguration, FieldDefinition, FieldType, SuggesterSourceType } from './types';
import { parseTemplateFields } from './parser/TemplateFrontmatterParser';
import { FolderSuggest } from './settings/FolderSuggest';
import { FileSuggest } from './settings/FileSuggest';
import { TagSuggest } from './settings/TagSuggest';

export class TaglineSettingTab extends PluginSettingTab {
	plugin: TaglinePlugin;
	private expandedConfigs: Set<number> = new Set();

	constructor(app: App, plugin: TaglinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('tagline-settings');

		this.renderGeneralSettings(containerEl);
		this.renderTagConfigurations(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		const generalGroup = containerEl.createDiv('settings-group');

		new Setting(generalGroup)
			.setName('General settings')
			.setHeading();

		new Setting(generalGroup)
			.setName('Open note after creation')
			.setDesc('Automatically open the newly created note in the editor')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.openNoteAfterCreation)
				.onChange(async (value) => {
					this.plugin.settings.openNoteAfterCreation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(generalGroup)
			.setName('Default template folder')
			.setDesc('Default folder for template suggestions (leave empty to show all files)')
			.addText(text => {
				text
					.setPlaceholder('Templates/')
					.setValue(this.plugin.settings.defaultTemplateFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultTemplateFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(generalGroup)
			.setName('Link format')
			.setDesc('Format for links to created notes')
			.addDropdown(dropdown => dropdown
				.addOption('wiki', 'Wiki links')
				.addOption('markdown', 'Markdown links')
				.setValue(this.plugin.settings.linkFormat)
				.onChange(async (value) => {
					this.plugin.settings.linkFormat = value as 'wiki' | 'markdown';
					await this.plugin.saveSettings();
				}));

		new Setting(generalGroup)
			.setName('Style inline fields')
			.setDesc('Display fields with visual styling (requires reload to take effect)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableFieldStyling)
				.onChange(async (value) => {
					this.plugin.settings.enableFieldStyling = value;
					await this.plugin.saveSettings();
				}));
	}

	private renderTagConfigurations(containerEl: HTMLElement): void {
		const tagGroup = containerEl.createDiv('settings-group');

		new Setting(tagGroup)
			.setName('Tag configurations')
			.setHeading()
			.addButton(button => button
				.setButtonText('Add configuration')
				.setCta()
				.onClick(async () => {
					const newIndex = this.plugin.settings.tagConfigurations.length;
					this.plugin.settings.tagConfigurations.push({
						tag: 'newtag',
						templatePath: '',
						outputFolder: '',
						fieldSource: 'manual',
						fields: []
					});
					this.expandedConfigs.add(newIndex);
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.tagConfigurations.length === 0) {
			tagGroup.createEl('p', {
				text: 'No tag configurations yet. Add one to get started.',
				cls: 'setting-item-description'
			});
			return;
		}

		for (let i = 0; i < this.plugin.settings.tagConfigurations.length; i++) {
			const config = this.plugin.settings.tagConfigurations[i];
			if (config) {
				this.renderCollapsibleTagConfig(tagGroup, config, i);
			}
		}
	}

	private renderCollapsibleTagConfig(containerEl: HTMLElement, config: TagConfiguration, index: number): void {
		const isExpanded = this.expandedConfigs.has(index);
		const fieldCount = config.fields.length;
		const fieldSummary = fieldCount === 1 ? '1 field' : `${fieldCount} fields`;

		const details = containerEl.createEl('details', { cls: 'tag-config-details' });
		if (isExpanded) {
			details.setAttribute('open', '');
		}

		details.addEventListener('toggle', () => {
			if (details.open) {
				this.expandedConfigs.add(index);
			} else {
				this.expandedConfigs.delete(index);
			}
		});

		const summary = details.createEl('summary', { cls: 'tag-config-summary' });
		const summaryContent = summary.createDiv('tag-config-summary-content');

		const tagInfo = summaryContent.createDiv('tag-config-info');
		tagInfo.createSpan({ text: `#${config.tag}`, cls: 'tag-config-tag' });
		tagInfo.createSpan({ text: fieldSummary, cls: 'tag-config-field-count' });

		if (config.templatePath) {
			tagInfo.createSpan({ text: config.templatePath, cls: 'tag-config-template' });
		}

		const deleteBtn = summaryContent.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning tag-config-delete'
		});
		deleteBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.plugin.settings.tagConfigurations.splice(index, 1);
			this.expandedConfigs.delete(index);
			const newExpanded = new Set<number>();
			this.expandedConfigs.forEach(i => {
				if (i > index) newExpanded.add(i - 1);
				else newExpanded.add(i);
			});
			this.expandedConfigs = newExpanded;
			await this.plugin.saveSettings();
			this.display();
		});

		const content = details.createDiv('tag-config-content');
		this.renderTagConfigContent(content, config, index);
	}

	private renderTagConfigContent(containerEl: HTMLElement, config: TagConfiguration, index: number): void {
		new Setting(containerEl)
			.setName('Tag')
			.setDesc('Tag name without #')
			.addText(text => text
				.setPlaceholder('todo')
				.setValue(config.tag)
				.onChange(async (value) => {
					config.tag = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Folder where created notes will be saved')
			.addText(text => {
				text
					.setPlaceholder('Tasks/')
					.setValue(config.outputFolder)
					.onChange(async (value) => {
						config.outputFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		this.renderCheckboxSyncSettings(containerEl, config);

		new Setting(containerEl)
			.setName('Field source')
			.setDesc('Where to get field definitions from')
			.addDropdown(dropdown => dropdown
				.addOption('manual', 'Manual configuration')
				.addOption('template', 'Parse from template')
				.setValue(config.fieldSource || 'manual')
				.onChange(async (value) => {
					config.fieldSource = value as 'manual' | 'template';
					if (value === 'template') {
						config.fields = [];
					}
					await this.plugin.saveSettings();
					this.display();
				}));

		if (config.fieldSource === 'template') {
			new Setting(containerEl)
				.setName('Template path')
				.setDesc('Path to the template file')
				.addText(text => {
					text
						.setPlaceholder('Templates/Todo.md')
						.setValue(config.templatePath)
						.onChange(async (value) => {
							config.templatePath = value;
							await this.plugin.saveSettings();
							this.display();
						});
					const folder = this.plugin.settings.defaultTemplateFolder || null;
					new FileSuggest(this.app, text.inputEl, '.md', folder);
				});

			this.renderTemplateFieldsPreview(containerEl, config);
		} else {
			this.renderManualFields(containerEl, config);
		}
	}

	private renderCheckboxSyncSettings(containerEl: HTMLElement, config: TagConfiguration): void {
		const descFragment = document.createDocumentFragment();
		descFragment.appendText('Sync checkbox state with frontmatter status field');

		if (config.syncCheckbox) {
			descFragment.createEl('br');
			const infoSpan = descFragment.createEl('span', {
				cls: 'checkbox-sync-info',
				attr: { style: 'font-size: 0.85em; opacity: 0.7;' }
			});
			infoSpan.appendText('For large vaults, install ');
			const link = infoSpan.createEl('a', {
				text: 'Backlink Cache',
				href: 'obsidian://show-plugin?id=backlink-cache'
			});
			link.setAttr('target', '_blank');
			infoSpan.appendText(' for better performance.');
		}

		new Setting(containerEl)
			.setName('Checkbox sync')
			.setDesc(descFragment)
			.addToggle(toggle => toggle
				.setValue(config.syncCheckbox || false)
				.onChange(async (value) => {
					config.syncCheckbox = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (config.syncCheckbox) {
			new Setting(containerEl)
				.setName('Status field')
				.setDesc('Frontmatter field to sync with checkbox')
				.addText(text => text
					.setPlaceholder('status')
					.setValue(config.statusField || '')
					.onChange(async (value) => {
						config.statusField = value || undefined;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Completed value')
				.setDesc('Value when checkbox is checked')
				.addText(text => text
					.setPlaceholder('Done')
					.setValue(config.completedValue || '')
					.onChange(async (value) => {
						config.completedValue = value || undefined;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Incomplete value')
				.setDesc('Value when checkbox is unchecked')
				.addText(text => text
					.setPlaceholder('To Do')
					.setValue(config.incompleteValue || '')
					.onChange(async (value) => {
						config.incompleteValue = value || undefined;
						await this.plugin.saveSettings();
					}));
		}
	}

	private renderTemplateFieldsPreview(containerEl: HTMLElement, config: TagConfiguration): void {
		const previewContainer = containerEl.createDiv('fields-manual-container');

		const header = previewContainer.createDiv('fields-manual-header');
		header.createSpan({ text: 'Detected fields', cls: 'setting-item-name' });

		if (!config.templatePath) {
			previewContainer.createDiv({
				text: 'Enter a template path to see detected fields.',
				cls: 'fields-preview-empty'
			});
			return;
		}

		previewContainer.createDiv({
			text: 'Fields are read from the template when inserted.',
			cls: 'setting-item-description fields-auto-note'
		});

		this.loadAndRenderTemplateFields(previewContainer, config.templatePath);
	}

	private async loadAndRenderTemplateFields(container: HTMLElement, templatePath: string): Promise<void> {
		const fields = await parseTemplateFields(this.app, templatePath);

		if (fields.length === 0) {
			container.createDiv({
				text: 'No fields found in template frontmatter.',
				cls: 'fields-preview-empty'
			});
			return;
		}

		const fieldList = container.createDiv('fields-list-editable');

		for (const field of fields) {
			const row = fieldList.createDiv('field-row-editable field-row-readonly');

			// Key group
			const keyGroup = row.createDiv('field-group');
			keyGroup.createSpan({ text: 'key:', cls: 'field-label' });
			keyGroup.createSpan({ text: field.key, cls: 'field-value field-value-key' });

			// Type group
			const typeGroup = row.createDiv('field-group');
			typeGroup.createSpan({ text: 'type:', cls: 'field-label' });
			typeGroup.createSpan({ text: field.type, cls: 'field-value' });

			// Source group (if set)
			if (field.source) {
				const sourceGroup = row.createDiv('field-group');
				sourceGroup.createSpan({ text: 'source:', cls: 'field-label' });
				sourceGroup.createSpan({ text: `${field.source.type}: ${field.source.value}`, cls: 'field-value field-value-source' });
			}

			// Default group (if set)
			if (field.defaultValue !== undefined && field.defaultValue !== '') {
				const defaultGroup = row.createDiv('field-group');
				defaultGroup.createSpan({ text: 'default:', cls: 'field-label' });
				defaultGroup.createSpan({ text: field.defaultValue, cls: 'field-value' });
			}
		}
	}

	private renderManualFields(containerEl: HTMLElement, config: TagConfiguration): void {
		const fieldsContainer = containerEl.createDiv('fields-manual-container');

		const header = fieldsContainer.createDiv('fields-manual-header');
		header.createSpan({ text: 'Fields', cls: 'setting-item-name' });

		const addBtn = header.createEl('button', { text: 'Add field', cls: 'fields-add-btn' });
		addBtn.addEventListener('click', async () => {
			config.fields.unshift({
				key: 'newfield',
				type: 'text'
			});
			await this.plugin.saveSettings();
			this.display();
		});

		if (config.fields.length === 0) {
			fieldsContainer.createDiv({
				text: 'No fields configured. Add fields to define the inline properties.',
				cls: 'fields-preview-empty'
			});
			return;
		}

		const fieldList = fieldsContainer.createDiv('fields-list-editable');

		for (let j = 0; j < config.fields.length; j++) {
			const field = config.fields[j];
			if (field) {
				this.renderCompactFieldRow(fieldList, config, field, j);
			}
		}
	}

	private renderCompactFieldRow(containerEl: HTMLElement, config: TagConfiguration, field: FieldDefinition, fieldIndex: number): void {
		const row = containerEl.createDiv('field-row-editable');

		// Key group
		const keyGroup = row.createDiv('field-group');
		keyGroup.createSpan({ text: 'key:', cls: 'field-label' });
		const keyInput = keyGroup.createEl('input', {
			type: 'text',
			cls: 'field-input field-key-input',
			placeholder: 'fieldname',
			value: field.key
		});
		keyInput.addEventListener('change', async () => {
			field.key = keyInput.value;
			await this.plugin.saveSettings();
		});

		// Type group
		const typeGroup = row.createDiv('field-group');
		typeGroup.createSpan({ text: 'type:', cls: 'field-label' });
		const typeSelect = typeGroup.createEl('select', { cls: 'field-select field-type-select' });
		const types: FieldType[] = ['text', 'number', 'boolean', 'date', 'datetime', 'list'];
		types.forEach(t => {
			const opt = typeSelect.createEl('option', { value: t, text: t });
			if (t === field.type) opt.selected = true;
		});
		typeSelect.addEventListener('change', async () => {
			field.type = typeSelect.value as FieldType;
			await this.plugin.saveSettings();
			this.display();
		});

		// Source group
		const sourceGroup = row.createDiv('field-group field-group-source');
		sourceGroup.createSpan({ text: 'source:', cls: 'field-label' });
		const sourceSelect = sourceGroup.createEl('select', { cls: 'field-select field-source-select' });
		const sources = [
			{ value: 'none', label: 'none' },
			{ value: 'options', label: 'options' },
			{ value: 'folder', label: 'folder' },
			{ value: 'tag', label: 'tag' },
			{ value: 'field', label: 'field' }
		];
		sources.forEach(s => {
			const opt = sourceSelect.createEl('option', { value: s.value, text: s.label });
			if ((field.source?.type || 'none') === s.value) opt.selected = true;
		});
		sourceSelect.addEventListener('change', async () => {
			const value = sourceSelect.value;
			if (value === 'none') {
				field.source = undefined;
			} else {
				field.source = {
					type: value as SuggesterSourceType,
					value: field.source?.value || ''
				};
			}
			await this.plugin.saveSettings();
			this.display();
		});

		// Source value input (only if source is set)
		if (field.source) {
			const sourceInput = sourceGroup.createEl('input', {
				type: 'text',
				cls: 'field-input field-source-input',
				placeholder: this.getSourcePlaceholder(field.source.type),
				value: field.source.value
			});
			sourceInput.addEventListener('change', async () => {
				if (field.source) {
					field.source.value = sourceInput.value;
					await this.plugin.saveSettings();
				}
			});

			if (field.source.type === 'folder') {
				new FolderSuggest(this.app, sourceInput);
			} else if (field.source.type === 'tag') {
				new TagSuggest(this.app, sourceInput);
			}
		}

		// Default group
		const defaultGroup = row.createDiv('field-group');
		defaultGroup.createSpan({ text: 'default:', cls: 'field-label' });
		const defaultInput = defaultGroup.createEl('input', {
			type: 'text',
			cls: 'field-input field-default-input',
			placeholder: '(none)',
			value: field.defaultValue || ''
		});
		defaultInput.addEventListener('change', async () => {
			field.defaultValue = defaultInput.value.trim() || undefined;
			await this.plugin.saveSettings();
		});

		// Remove button
		const removeBtn = row.createEl('button', {
			text: '×',
			cls: 'field-remove-btn',
			attr: { 'aria-label': 'Remove field' }
		});
		removeBtn.addEventListener('click', async () => {
			config.fields.splice(fieldIndex, 1);
			await this.plugin.saveSettings();
			this.display();
		});
	}

	private getSourcePlaceholder(type: SuggesterSourceType): string {
		switch (type) {
			case 'options': return 'high,medium,low';
			case 'folder': return 'People/';
			case 'tag': return 'person';
			case 'field': return 'status';
		}
	}
}
