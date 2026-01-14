/**
 * Mise Settings Tab
 * 
 * Settings UI for configuring plugin paths and options.
 */

import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import type MisePlugin from '../../main';
import { DEFAULT_SETTINGS, MiseSettings, StoreProfile } from '../../types';
import { FolderSuggest } from '../components/FolderSuggest';
import { StoreProfileModal } from './StoreProfileModal';

export class MiseSettingsTab extends PluginSettingTab {
    plugin: MisePlugin;

    constructor(app: App, plugin: MisePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header
        containerEl.createEl('h1', { text: 'Mise Settings' });
        containerEl.createEl('p', {
            text: 'Configure your culinary operating system.',
            cls: 'mise-settings-description'
        });

        // ========================================
        // Folder Paths Section
        // ========================================
        containerEl.createEl('h2', { text: '📁 Folder Paths' });

        // Recipes Folder
        new Setting(containerEl)
            .setName('Recipes Folder')
            .setDesc('The folder containing your recipe markdown files.')
            .addText(text => {
                text
                    .setPlaceholder('Type to search folders...')
                    .setValue(this.plugin.settings.recipesFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.recipesFolder = value;
                        await this.plugin.saveSettings();
                    });
                // Attach folder autocomplete
                new FolderSuggest(this.app, text.inputEl);
            });

        // Meal Plan Folder
        new Setting(containerEl)
            .setName('Meal Plan Folder')
            .setDesc('The folder where meal plan files are stored.')
            .addText(text => {
                text
                    .setPlaceholder('Type to search folders...')
                    .setValue(this.plugin.settings.mealPlanFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.mealPlanFolder = value;
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        // Shopping List Folder
        new Setting(containerEl)
            .setName('Shopping List Folder')
            .setDesc('The folder where shopping lists are generated.')
            .addText(text => {
                text
                    .setPlaceholder('Type to search folders...')
                    .setValue(this.plugin.settings.shoppingListFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.shoppingListFolder = value;
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        // ========================================
        // Shopping List Options
        // ========================================
        containerEl.createEl('h2', { text: '🛒 Shopping Lists' });

        // Auto-archive dropdown
        new Setting(containerEl)
            .setName('Auto-archive Shopping Lists')
            .setDesc('What to do with old shopping lists when generating new ones.')
            .addDropdown(dropdown => dropdown
                .addOption('off', 'Off - Keep all lists in place')
                .addOption('on', 'On - Automatically archive')
                .addOption('ask', 'Ask every time')
                .setValue(this.plugin.settings.autoArchiveShoppingLists)
                .onChange(async (value: 'on' | 'off' | 'ask') => {
                    this.plugin.settings.autoArchiveShoppingLists = value;
                    await this.plugin.saveSettings();
                }));

        // ========================================
        // Meal Plan Insert Options
        // ========================================
        containerEl.createEl('h2', { text: '📅 Meal Plan Insertion' });
        containerEl.createEl('p', {
            text: 'Configure what gets inserted when you add a recipe to a meal plan.',
            cls: 'mise-settings-description'
        });

        const insertOptions = this.plugin.settings.mealPlanInsertOptions;

        new Setting(containerEl)
            .setName('Include Servings')
            .setDesc('Add servings info when inserting a recipe.')
            .addToggle(toggle => toggle
                .setValue(insertOptions.includeServings)
                .onChange(async (value) => {
                    this.plugin.settings.mealPlanInsertOptions.includeServings = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Prep/Cook Time')
            .setDesc('Add time information when inserting a recipe.')
            .addToggle(toggle => toggle
                .setValue(insertOptions.includeTime)
                .onChange(async (value) => {
                    this.plugin.settings.mealPlanInsertOptions.includeTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Ingredients (Inline)')
            .setDesc('Add a comma-separated ingredient list.')
            .addToggle(toggle => toggle
                .setValue(insertOptions.includeIngredientsInline)
                .onChange(async (value) => {
                    this.plugin.settings.mealPlanInsertOptions.includeIngredientsInline = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Ingredients (Callout)')
            .setDesc('Add ingredients in a collapsible callout block.')
            .addToggle(toggle => toggle
                .setValue(insertOptions.includeIngredientsCallout)
                .onChange(async (value) => {
                    this.plugin.settings.mealPlanInsertOptions.includeIngredientsCallout = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Source Link')
            .setDesc('Add the source URL if available.')
            .addToggle(toggle => toggle
                .setValue(insertOptions.includeSource)
                .onChange(async (value) => {
                    this.plugin.settings.mealPlanInsertOptions.includeSource = value;
                    await this.plugin.saveSettings();
                }));

        // ========================================
        // Store Profiles
        // ========================================
        containerEl.createEl('h2', { text: '🏪 Store Profiles' });
        containerEl.createEl('p', {
            text: 'Create custom aisle configurations for your favorite stores.',
            cls: 'mise-settings-description'
        });

        const profilesContainer = containerEl.createDiv('mise-store-profiles');

        // List existing profiles
        this.plugin.settings.storeProfiles.forEach((profile, index) => {
            const profileDiv = profilesContainer.createDiv('mise-profile-item');
            profileDiv.addClass('mise-card'); // Use card styling
            profileDiv.style.marginBottom = '10px';
            profileDiv.style.padding = '10px';
            profileDiv.style.display = 'flex';
            profileDiv.style.alignItems = 'center';
            profileDiv.style.justifyContent = 'space-between';

            const infoDiv = profileDiv.createDiv();
            infoDiv.createEl('strong', { text: profile.name });
            if (profile.isDefault) {
                infoDiv.createEl('span', { text: ' (Default)', cls: 'mise-tag' });
            }
            const detailsDiv = infoDiv.createDiv({
                text: `${profile.aisles.length} aisle mappings`,
                cls: 'mise-text-muted'
            });
            detailsDiv.style.fontSize = '0.8em';

            const btnDiv = profileDiv.createDiv();
            btnDiv.style.display = 'flex';
            btnDiv.style.gap = '5px';

            const editBtn = btnDiv.createEl('button', { text: 'Edit' });
            editBtn.onclick = () => {
                new StoreProfileModal(this.app, profile, async (updatedProfile: StoreProfile) => {
                    this.plugin.settings.storeProfiles[index] = updatedProfile;
                    // Ensure only one default
                    if (updatedProfile.isDefault) {
                        this.plugin.settings.storeProfiles.forEach((p, i) => {
                            if (i !== index) p.isDefault = false;
                        });
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }).open();
            };

            const deleteBtn = btnDiv.createEl('button', { text: 'Delete' });
            deleteBtn.onclick = async () => {
                this.plugin.settings.storeProfiles.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            };
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Add Store Profile')
                .onClick(() => {
                    new StoreProfileModal(this.app, null, async (newProfile: StoreProfile) => {
                        this.plugin.settings.storeProfiles.push(newProfile);
                        // Ensure only one default
                        if (newProfile.isDefault) {
                            this.plugin.settings.storeProfiles.forEach(p => {
                                if (p !== newProfile) p.isDefault = false;
                            });
                        }
                        await this.plugin.saveSettings();
                        this.display();
                    }).open();
                }));

        // ========================================
        // Reset to Defaults
        // ========================================
        containerEl.createEl('h2', { text: '⚙️ Advanced' });

        new Setting(containerEl)
            .setName('Reset to Defaults')
            .setDesc('Reset all settings to their default values.')
            .addButton(button => button
                .setButtonText('Reset')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings = { ...DEFAULT_SETTINGS };
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings display
                }));
    }
}
