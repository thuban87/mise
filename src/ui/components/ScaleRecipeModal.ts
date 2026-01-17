/**
 * ScaleRecipeModal - Modal for scaling a recipe and creating a scaled copy
 * 
 * Used from right-click context menu on recipe files.
 */

import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { Recipe } from '../../types';
import { RecipeScalingService } from '../../services/RecipeScalingService';
import { parseIngredient, scaleQuantity, formatScaledIngredient } from '../../utils/QuantityParser';

export class ScaleRecipeModal extends Modal {
    private recipe: Recipe;
    private scalingService: RecipeScalingService;
    private targetServings: number;
    private currentServings: number | null;
    private previewContainer: HTMLElement | null = null;

    constructor(
        app: App,
        recipe: Recipe,
        scalingService: RecipeScalingService
    ) {
        super(app);
        this.recipe = recipe;
        this.scalingService = scalingService;
        this.currentServings = this.scalingService.parseServings(recipe.servings);
        this.targetServings = this.currentServings || 4;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-scale-modal');

        // Title
        contentEl.createEl('h2', { text: '⚖️ Scale Recipe' });
        contentEl.createEl('p', {
            text: this.recipe.title,
            cls: 'mise-scale-recipe-name'
        });

        // Current servings display
        if (this.currentServings) {
            new Setting(contentEl)
                .setName('Current Servings')
                .setDesc(`This recipe makes ${this.recipe.servings}`)
                .setDisabled(true);
        } else {
            contentEl.createEl('p', {
                text: '⚠️ Could not parse servings from this recipe. Please enter current servings manually.',
                cls: 'mise-scale-warning'
            });

            new Setting(contentEl)
                .setName('Current Servings')
                .setDesc('Enter the current number of servings')
                .addText(text => text
                    .setPlaceholder('e.g., 4')
                    .setValue('')
                    .onChange(value => {
                        const parsed = parseInt(value);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.currentServings = parsed;
                            this.updatePreview();
                        }
                    }));
        }

        // Target servings input
        new Setting(contentEl)
            .setName('Scale to Servings')
            .setDesc('Enter the number of servings you want')
            .addText(text => text
                .setPlaceholder('e.g., 8')
                .setValue(this.targetServings.toString())
                .onChange(value => {
                    const parsed = parseInt(value);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.targetServings = parsed;
                        this.updatePreview();
                    }
                }));

        // Scale factor display
        if (this.currentServings) {
            const factor = this.targetServings / this.currentServings;
            contentEl.createEl('p', {
                text: `Scale factor: ${factor.toFixed(2)}x`,
                cls: 'mise-scale-factor'
            });
        }

        // Preview section
        contentEl.createEl('h3', { text: 'Preview' });
        this.previewContainer = contentEl.createDiv({ cls: 'mise-scale-preview' });
        this.updatePreview();

        // Action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'mise-scale-buttons' });

        const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'mise-btn mise-btn-secondary'
        });
        cancelBtn.onclick = () => this.close();

        const createBtn = buttonContainer.createEl('button', {
            text: '📄 Create Scaled Copy',
            cls: 'mise-btn mise-btn-primary'
        });
        createBtn.onclick = () => this.createScaledCopy();
    }

    private updatePreview() {
        if (!this.previewContainer) return;
        this.previewContainer.empty();

        if (!this.currentServings) {
            this.previewContainer.createEl('p', {
                text: 'Enter current servings to see preview',
                cls: 'mise-scale-preview-empty'
            });
            return;
        }

        const factor = this.targetServings / this.currentServings;

        // Show scaled ingredients
        const list = this.previewContainer.createEl('ul', { cls: 'mise-scale-ingredient-list' });

        for (const ingredient of this.recipe.ingredients) {
            const parsed = parseIngredient(ingredient);
            const scaled = scaleQuantity(parsed, factor);
            const formatted = formatScaledIngredient(scaled);

            const li = list.createEl('li');

            if (parsed.scalable && factor !== 1) {
                // Show as changed
                li.createSpan({ text: formatted, cls: 'mise-scale-changed' });
                li.createSpan({ text: ` (was: ${ingredient})`, cls: 'mise-scale-original' });
            } else {
                // Unchanged
                li.setText(formatted);
            }
        }
    }

    private async createScaledCopy() {
        if (!this.currentServings) {
            new Notice('Please enter current servings');
            return;
        }

        try {
            const newPath = await this.scalingService.createScaledCopy(
                this.recipe.path,
                this.targetServings
            );

            new Notice(`✅ Created: ${newPath.split('/').pop()}`);

            // Open the new file
            const file = this.app.vault.getAbstractFileByPath(newPath);
            if (file && file instanceof TFile) {
                await this.app.workspace.getLeaf('tab').openFile(file);
            }

            this.close();
        } catch (error) {
            console.error('ScaleRecipeModal: Error creating scaled copy:', error);
            new Notice(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
