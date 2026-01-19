/**
 * QuickLogModal - Log snacks and individual ingredients without a recipe
 * 
 * Simple modal for:
 * - Logging quick meals/snacks
 * - Deducting from inventory
 * - Writing to Meal Log
 */

import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import { MiseSettings } from '../../types';
import { InventoryService } from '../../services/InventoryService';
import { IngredientIndexService } from '../../services/IngredientIndexService';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface QuickLogItem {
    quantity: number;
    unit: string;
    name: string;
}

const COMMON_UNITS = [
    'count', 'oz', 'lb', 'g', 'cup', 'tbsp', 'tsp', 'ml', 'slice', 'piece'
];

export class QuickLogModal extends Modal {
    private settings: MiseSettings;
    private inventoryService: InventoryService;
    private ingredientIndex: IngredientIndexService;

    // State
    private mealType: MealType = 'snack';
    private items: QuickLogItem[] = [{ quantity: 1, unit: 'oz', name: '' }];

    constructor(
        app: App,
        settings: MiseSettings,
        inventoryService: InventoryService,
        ingredientIndex: IngredientIndexService
    ) {
        super(app);
        this.settings = settings;
        this.inventoryService = inventoryService;
        this.ingredientIndex = ingredientIndex;
    }

    onOpen() {
        this.render();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-quick-log-modal');

        contentEl.createEl('h2', { text: '🍿 Quick Log' });
        contentEl.createEl('p', {
            text: 'Log a snack or quick meal without creating a recipe.',
            cls: 'mise-modal-description'
        });

        // Meal type selector
        new Setting(contentEl)
            .setName('Meal Type')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('breakfast', 'Breakfast')
                    .addOption('lunch', 'Lunch')
                    .addOption('dinner', 'Dinner')
                    .addOption('snack', 'Snack')
                    .setValue(this.mealType)
                    .onChange(value => {
                        this.mealType = value as MealType;
                    });
            });

        // Items section
        const itemsSection = contentEl.createDiv('mise-quick-log-items');
        itemsSection.createEl('h4', { text: 'Items' });
        itemsSection.style.marginTop = '16px';

        // Create datalist for autocomplete
        const datalist = itemsSection.createEl('datalist', { attr: { id: 'quick-log-ingredients' } });
        if (this.ingredientIndex.isReady()) {
            // Add inventory items first
            const inventory = this.inventoryService.getStock();
            const addedNames = new Set<string>();
            for (const item of inventory) {
                datalist.createEl('option', { value: item.name });
                addedNames.add(item.name.toLowerCase());
            }
            // Add indexed ingredients
            const indexed = this.ingredientIndex.getAllIngredients();
            for (const ing of indexed) {
                if (!addedNames.has(ing.name.toLowerCase())) {
                    datalist.createEl('option', { value: ing.name });
                }
            }
        }

        // Render each item row
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const row = itemsSection.createDiv('mise-quick-log-row');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.marginBottom = '8px';

            // Quantity
            const qtyInput = row.createEl('input', {
                type: 'number',
                value: String(item.quantity),
                attr: { min: '0', step: '0.25' }
            });
            qtyInput.style.width = '60px';
            qtyInput.style.textAlign = 'center';
            qtyInput.onchange = () => {
                item.quantity = parseFloat(qtyInput.value) || 0;
            };

            // Unit
            const unitSelect = row.createEl('select');
            unitSelect.style.width = '70px';
            for (const unit of COMMON_UNITS) {
                const opt = unitSelect.createEl('option', { value: unit, text: unit });
                if (unit === item.unit) opt.selected = true;
            }
            unitSelect.onchange = () => {
                item.unit = unitSelect.value;
            };

            // Name with autocomplete
            const nameInput = row.createEl('input', {
                type: 'text',
                placeholder: 'Item name...',
                value: item.name,
                attr: { list: 'quick-log-ingredients' }
            });
            nameInput.style.flex = '1';
            nameInput.oninput = () => {
                item.name = nameInput.value;
            };

            // Remove button (if more than one item)
            if (this.items.length > 1) {
                const removeBtn = row.createEl('button', { text: '×' });
                removeBtn.style.padding = '4px 8px';
                removeBtn.onclick = () => {
                    this.items.splice(i, 1);
                    this.render();
                };
            }
        }

        // Add item button
        const addBtn = itemsSection.createEl('button', { text: '+ Add Item' });
        addBtn.style.marginTop = '8px';
        addBtn.onclick = () => {
            this.items.push({ quantity: 1, unit: 'oz', name: '' });
            this.render();
        };

        // Buttons
        const buttonContainer = contentEl.createDiv('mise-modal-nav');
        buttonContainer.style.marginTop = '24px';
        buttonContainer.style.paddingTop = '16px';
        buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '8px';

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const logBtn = buttonContainer.createEl('button', {
            text: '✓ Log & Deduct',
            cls: 'mod-cta'
        });
        logBtn.onclick = () => this.doLog(logBtn);
    }

    private async doLog(button: HTMLButtonElement) {
        // Filter valid items
        const validItems = this.items.filter(i => i.name.trim() && i.quantity > 0);

        if (validItems.length === 0) {
            new Notice('Please add at least one item');
            return;
        }

        button.textContent = 'Logging...';
        button.disabled = true;

        try {
            // 1. Deduct from inventory
            let deducted = 0;
            let notFound = 0;

            for (const item of validItems) {
                const result = await this.inventoryService.deductStock(
                    item.name,
                    item.quantity,
                    item.unit
                );
                if (result.found) {
                    deducted++;
                } else {
                    notFound++;
                }
            }

            // 2. Write to Meal Log
            await this.writeMealLog(validItems);

            // 3. Add items to ingredient index
            for (const item of validItems) {
                await this.ingredientIndex.addIngredient(item.name, 'meal-log');
            }

            // 4. Show results
            const mealLabel = this.mealType.charAt(0).toUpperCase() + this.mealType.slice(1);
            let message = `✅ Logged ${mealLabel}`;
            if (deducted > 0) {
                message += ` (${deducted} deducted)`;
            }
            if (notFound > 0) {
                message += ` ⚠️ ${notFound} not in inventory`;
            }

            new Notice(message);
            this.close();

        } catch (error: any) {
            console.error('QuickLogModal: Error logging', error);
            new Notice(`❌ Error: ${error.message || 'Unknown error'}`);
            button.textContent = '✓ Log & Deduct';
            button.disabled = false;
        }
    }

    private async writeMealLog(items: QuickLogItem[]) {
        const inventoryFolder = this.settings.inventoryFolder;
        const parentFolder = inventoryFolder.substring(0, inventoryFolder.lastIndexOf('/')) || inventoryFolder;
        const logPath = `${parentFolder}/Meal Log.md`;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const mealLabel = this.mealType.charAt(0).toUpperCase() + this.mealType.slice(1);

        // Build log entry
        let entry = `\n## ${dateStr} ${timeStr} - ${mealLabel}\n\n`;
        entry += `**Recipe:** Quick Log\n\n`;
        entry += `**Items:**\n`;

        for (const item of items) {
            const qtyStr = item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2);
            entry += `- ${qtyStr} ${item.unit} ${item.name}\n`;
        }
        entry += `\n---\n`;

        // Get or create log file
        const file = this.app.vault.getAbstractFileByPath(logPath);

        if (file && file instanceof TFile) {
            const existingContent = await this.app.vault.read(file);
            await this.app.vault.modify(file, existingContent + entry);
        } else {
            const header = `# Meal Log\n\n> [!NOTE]\n> Meals logged through Mise for calorie tracking. Delete entries after logging to your calorie app.\n\n---\n`;
            await this.app.vault.create(logPath, header + entry);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
