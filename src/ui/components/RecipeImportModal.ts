/**
 * RecipeImportModal - Modal for importing recipes from URLs
 * 
 * Simple modal with URL input, category selection, and import button.
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { RecipeCategory } from '../../types';
import { ImporterService } from '../../services/ImporterService';

const RECIPE_CATEGORIES: RecipeCategory[] = [
    'Main',
    'Breakfast',
    'Appetizer',
    'Side',
    'Dessert',
    'Beverage',
    'Snack',
    'Uncategorized',
];

export class RecipeImportModal extends Modal {
    private url: string = '';
    private category: RecipeCategory = 'Main';
    private importerService: ImporterService;
    private onSuccess: (filePath: string) => void;

    constructor(
        app: App,
        importerService: ImporterService,
        onSuccess: (filePath: string) => void
    ) {
        super(app);
        this.importerService = importerService;
        this.onSuccess = onSuccess;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-import-modal');

        contentEl.createEl('h2', { text: '📥 Import Recipe' });

        contentEl.createEl('p', {
            text: 'Paste a recipe URL to import it into your cookbook.',
            cls: 'mise-modal-description'
        });

        // URL input
        new Setting(contentEl)
            .setName('Recipe URL')
            .setDesc('The URL of the recipe page to import')
            .addText(text => {
                text
                    .setPlaceholder('https://example.com/recipe')
                    .onChange(value => {
                        this.url = value.trim();
                    });
                text.inputEl.style.width = '100%';
                text.inputEl.addEventListener('paste', (e) => {
                    // Auto-paste handling
                    setTimeout(() => {
                        this.url = text.getValue().trim();
                    }, 0);
                });
            });

        // Category dropdown
        new Setting(contentEl)
            .setName('Category')
            .setDesc('Assign a category to the imported recipe')
            .addDropdown(dropdown => {
                for (const cat of RECIPE_CATEGORIES) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.setValue(this.category);
                dropdown.onChange(value => {
                    this.category = value as RecipeCategory;
                });
            });

        // Import button
        const buttonContainer = contentEl.createDiv('mise-modal-nav');

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const importBtn = buttonContainer.createEl('button', {
            text: 'Import',
            cls: 'mod-cta'
        });
        importBtn.onclick = () => this.doImport(importBtn);
    }

    private async doImport(button: HTMLButtonElement) {
        // Validate URL
        if (!this.url) {
            new Notice('Please enter a URL');
            return;
        }

        try {
            new URL(this.url);  // Validate URL format
        } catch {
            new Notice('Please enter a valid URL');
            return;
        }

        // Show loading state
        const originalText = button.textContent;
        button.textContent = 'Importing...';
        button.disabled = true;

        try {
            const filePath = await this.importerService.importFromUrl(this.url, this.category);

            new Notice('✅ Recipe imported successfully!');
            this.close();
            this.onSuccess(filePath);
        } catch (error: any) {
            console.error('RecipeImportModal: Import failed', error);
            new Notice(`❌ Import failed: ${error.message || 'Unknown error'}`);

            // Restore button
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
