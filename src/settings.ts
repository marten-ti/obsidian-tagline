import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type InlineTemplateNotesPlugin from './main';
import type { TagConfiguration, FieldDefinition, FieldType } from './types';
import { parseTemplateFields } from './parser/TemplateFrontmatterParser';

export class InlineTemplateNotesSettingTab extends PluginSettingTab {
	plugin: InlineTemplateNotesPlugin;

	constructor(app: App, plugin: InlineTemplateNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Inline Template Notes Settings' });

		new Setting(containerEl)
			.setName('Add tag configuration')
			.setDesc('Configure a tag to trigger inline template fields')
			.addButton(button => button
				.setButtonText('Add')
				.onClick(async () => {
					this.plugin.settings.tagConfigurations.push({
						tag: 'newtag',
						templatePath: '',
						outputFolder: '',
						fieldSource: 'manual',
						fields: []
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		for (let i = 0; i < this.plugin.settings.tagConfigurations.length; i++) {
			const config = this.plugin.settings.tagConfigurations[i];
			if (config) {
				this.renderTagConfig(containerEl, config, i);
			}
		}
	}

	renderTagConfig(containerEl: HTMLElement, config: TagConfiguration, index: number): void {
		const configContainer = containerEl.createDiv({ cls: 'tag-config-container' });
		configContainer.style.border = '1px solid var(--background-modifier-border)';
		configContainer.style.padding = '12px';
		configContainer.style.marginBottom = '12px';
		configContainer.style.borderRadius = '8px';

		new Setting(configContainer)
			.setName(`Tag configuration #${index + 1}`)
			.setHeading()
			.addButton(button => button
				.setButtonText('Delete')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.tagConfigurations.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(configContainer)
			.setName('Tag')
			.setDesc('Tag name without #')
			.addText(text => text
				.setPlaceholder('todo')
				.setValue(config.tag)
				.onChange(async (value) => {
					config.tag = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configContainer)
			.setName('Template path')
			.setDesc('Path to the template file')
			.addText(text => text
				.setPlaceholder('Templates/Todo.md')
				.setValue(config.templatePath)
				.onChange(async (value) => {
					config.templatePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configContainer)
			.setName('Output folder')
			.setDesc('Folder where created notes will be saved')
			.addText(text => text
				.setPlaceholder('Tasks/')
				.setValue(config.outputFolder)
				.onChange(async (value) => {
					config.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(configContainer)
			.setName('Field source')
			.setDesc('Where to get field definitions from')
			.addDropdown(dropdown => dropdown
				.addOption('manual', 'Manual configuration')
				.addOption('template', 'Parse from template')
				.setValue(config.fieldSource || 'manual')
				.onChange(async (value) => {
					config.fieldSource = value as 'manual' | 'template';
					await this.plugin.saveSettings();
					this.display();
				}));

		if (config.fieldSource === 'template') {
			new Setting(configContainer)
				.setName('Parse template')
				.setDesc('Parse fields from template frontmatter. Add @suggest: hints for autocomplete.')
				.addButton(button => button
					.setButtonText('Parse now')
					.onClick(async () => {
						if (!config.templatePath) {
							new Notice('Please set a template path first');
							return;
						}
						const fields = await parseTemplateFields(this.app, config.templatePath);
						if (fields.length === 0) {
							new Notice('No fields found in template frontmatter.');
							return;
						}
						config.fields = fields;
						await this.plugin.saveSettings();
						const hintsCount = fields.filter(f => f.type !== 'text').length;
						new Notice(`Parsed ${fields.length} fields (${hintsCount} with autocomplete hints)`);
						this.display();
					}));

			if (config.fields.length > 0) {
				const previewContainer = configContainer.createDiv({ cls: 'fields-preview' });
				previewContainer.style.marginTop = '8px';
				previewContainer.style.padding = '8px';
				previewContainer.style.backgroundColor = 'var(--background-secondary)';
				previewContainer.style.borderRadius = '4px';
				previewContainer.style.fontSize = '0.9em';

				previewContainer.createEl('div', { text: 'Parsed fields:', cls: 'setting-item-name' });
				const fieldList = previewContainer.createEl('ul');
				fieldList.style.marginTop = '4px';
				fieldList.style.paddingLeft = '20px';

				for (const field of config.fields) {
					const li = fieldList.createEl('li');
					let desc = `${field.key}: ${field.type}`;
					if (field.options) desc += ` (${field.options.join(', ')})`;
					if (field.suggesterSource) desc += ` → ${field.suggesterSource.type}:${field.suggesterSource.value}`;
					if (field.multiple) desc += ' [multiple]';
					if (field.defaultValue !== undefined) desc += ` = "${field.defaultValue}"`;
					li.setText(desc);
				}
			}
		} else {
			const fieldsContainer = configContainer.createDiv({ cls: 'fields-container' });
			fieldsContainer.style.marginTop = '12px';
			fieldsContainer.style.paddingLeft = '12px';

			new Setting(fieldsContainer)
				.setName('Fields')
				.setDesc('Configure inline fields for this tag')
				.addButton(button => button
					.setButtonText('Add field')
					.onClick(async () => {
						config.fields.push({
							key: 'newfield',
							type: 'text'
						});
						await this.plugin.saveSettings();
						this.display();
					}));

			for (let j = 0; j < config.fields.length; j++) {
				const field = config.fields[j];
				if (field) {
					this.renderFieldConfig(fieldsContainer, config, field, j);
				}
			}
		}
	}

	renderFieldConfig(containerEl: HTMLElement, config: TagConfiguration, field: FieldDefinition, fieldIndex: number): void {
		const fieldContainer = containerEl.createDiv({ cls: 'field-config' });
		fieldContainer.style.marginLeft = '12px';
		fieldContainer.style.marginBottom = '8px';
		fieldContainer.style.padding = '8px';
		fieldContainer.style.backgroundColor = 'var(--background-secondary)';
		fieldContainer.style.borderRadius = '4px';

		new Setting(fieldContainer)
			.setName('Field key')
			.addText(text => text
				.setPlaceholder('priority')
				.setValue(field.key)
				.onChange(async (value) => {
					field.key = value;
					await this.plugin.saveSettings();
				}))
			.addDropdown(dropdown => dropdown
				.addOption('text', 'Text')
				.addOption('number', 'Number')
				.addOption('checkbox', 'Checkbox')
				.addOption('date', 'Date')
				.addOption('datetime', 'Date & Time')
				.addOption('options', 'Options')
				.addOption('suggester', 'Suggester')
				.setValue(field.type)
				.onChange(async (value) => {
					field.type = value as FieldType;
					await this.plugin.saveSettings();
					this.display();
				}))
			.addButton(button => button
				.setButtonText('Remove')
				.onClick(async () => {
					config.fields.splice(fieldIndex, 1);
					await this.plugin.saveSettings();
					this.display();
				}));

		if (field.type === 'options') {
			new Setting(fieldContainer)
				.setName('Options')
				.setDesc('Comma-separated list of options')
				.addText(text => text
					.setPlaceholder('high, medium, low')
					.setValue(field.options?.join(', ') || '')
					.onChange(async (value) => {
						field.options = value.split(',').map(s => s.trim()).filter(s => s);
						await this.plugin.saveSettings();
					}));
		}

		if (field.type === 'suggester') {
			new Setting(fieldContainer)
				.setName('Suggester source')
				.setDesc('Where to get suggestions from')
				.addDropdown(dropdown => dropdown
					.addOption('folder', 'Folder')
					.addOption('tag', 'Tag')
					.setValue(field.suggesterSource?.type || 'folder')
					.onChange(async (value) => {
						field.suggesterSource = {
							type: value as 'folder' | 'tag',
							value: field.suggesterSource?.value || ''
						};
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder(field.suggesterSource?.type === 'tag' ? 'person' : 'People/')
					.setValue(field.suggesterSource?.value || '')
					.onChange(async (value) => {
						field.suggesterSource = {
							type: field.suggesterSource?.type || 'folder',
							value
						};
						await this.plugin.saveSettings();
					}));

			new Setting(fieldContainer)
				.setName('Allow multiple')
				.setDesc('Allow selecting multiple values')
				.addToggle(toggle => toggle
					.setValue(field.multiple || false)
					.onChange(async (value) => {
						field.multiple = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(fieldContainer)
			.setName('Default value')
			.addText(text => text
				.setPlaceholder('(none)')
				.setValue(field.defaultValue || '')
				.onChange(async (value) => {
					field.defaultValue = value || undefined;
					await this.plugin.saveSettings();
				}));
	}
}
