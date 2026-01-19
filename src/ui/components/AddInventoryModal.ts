/**
 * AddInventoryModal - Modal for adding items to kitchen inventory
 * 
 * Allows users to add new inventory items with:
 * - Item name (with normalization)
 * - Quantity and unit
 * - Category (Pantry/Fridge/Freezer)
 * - Location (user-defined within category)
 * - Purchase date
 * - Expiration date and type
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { MiseSettings, InventoryItem, InventoryCategory, ExpiryType } from '../../types';
import { InventoryService } from '../../services/InventoryService';
import { IngredientIndexService } from '../../services/IngredientIndexService';
import { IngredientSuggest } from './IngredientSuggest';

const CATEGORIES: InventoryCategory[] = ['Pantry', 'Fridge', 'Freezer'];

const COMMON_UNITS = [
    'count', 'oz', 'lb', 'g', 'kg',
    'cup', 'cups', 'tbsp', 'tsp',
    'ml', 'L', 'gal', 'qt', 'pint',
    'can', 'box', 'bag', 'bottle', 'jar'
];

export class AddInventoryModal extends Modal {
    private settings: MiseSettings;
    private inventoryService: InventoryService;
    private ingredientIndex: IngredientIndexService;
    private onSuccess: () => void;

    // Form state
    private itemName: string = '';
    private quantity: number = 1;
    private unit: string = 'count';
    private category: InventoryCategory = 'Pantry';
    private location: string = 'Pantry';
    private purchaseDate: string = new Date().toISOString().split('T')[0];
    private expirationDate: string = '';
    private expirationType: ExpiryType | '' = '';

    constructor(
        app: App,
        settings: MiseSettings,
        inventoryService: InventoryService,
        ingredientIndex: IngredientIndexService,
        onSuccess: () => void
    ) {
        super(app);
        this.settings = settings;
        this.inventoryService = inventoryService;
        this.ingredientIndex = ingredientIndex;
        this.onSuccess = onSuccess;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-add-inventory-modal');

        contentEl.createEl('h2', { text: '📦 Add Inventory Item' });

        contentEl.createEl('p', {
            text: 'Add a new item to your kitchen inventory.',
            cls: 'mise-modal-description'
        });

        // Item name input with autocomplete
        new Setting(contentEl)
            .setName('Item Name')
            .setDesc('What are you adding? Start typing for suggestions.')
            .addText(text => {
                text
                    .setPlaceholder('e.g., Flour, Milk, Chicken Breast')
                    .onChange(value => {
                        this.itemName = value.trim();
                    });
                text.inputEl.style.width = '100%';
                // Add ingredient autocomplete
                new IngredientSuggest(
                    this.app,
                    text.inputEl,
                    this.ingredientIndex,
                    (ingredient) => {
                        this.itemName = ingredient.name;
                    }
                );
            });

        // Quantity and Unit row
        const qtyUnitRow = new Setting(contentEl)
            .setName('Quantity');

        qtyUnitRow.addText(text => {
            text
                .setPlaceholder('1')
                .setValue(String(this.quantity))
                .onChange(value => {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num > 0) {
                        this.quantity = num;
                    }
                });
            text.inputEl.type = 'number';
            text.inputEl.style.width = '80px';
            text.inputEl.min = '0.1';
            text.inputEl.step = '0.1';
        });

        qtyUnitRow.addDropdown(dropdown => {
            for (const u of COMMON_UNITS) {
                dropdown.addOption(u, u);
            }
            dropdown.setValue(this.unit);
            dropdown.onChange(value => {
                this.unit = value;
            });
        });

        // Category dropdown
        new Setting(contentEl)
            .setName('Category')
            .setDesc('Where is this item stored?')
            .addDropdown(dropdown => {
                for (const cat of CATEGORIES) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.setValue(this.category);
                dropdown.onChange(value => {
                    this.category = value as InventoryCategory;
                    // Update location default when category changes
                    this.location = value;
                });
            });

        // Location dropdown (from settings)
        new Setting(contentEl)
            .setName('Location')
            .setDesc('Specific storage location')
            .addDropdown(dropdown => {
                // Use settings.storageLocations
                for (const loc of this.settings.storageLocations) {
                    dropdown.addOption(loc, loc);
                }
                dropdown.setValue(this.location);
                dropdown.onChange(value => {
                    this.location = value;
                });
            });

        // Purchase date
        new Setting(contentEl)
            .setName('Purchase Date')
            .addText(text => {
                text
                    .setValue(this.purchaseDate)
                    .onChange(value => {
                        this.purchaseDate = value;
                    });
                text.inputEl.type = 'date';
            });

        // Expiration section
        contentEl.createEl('h4', { text: 'Expiration (Optional)' });

        // Expiration date
        new Setting(contentEl)
            .setName('Expires')
            .addText(text => {
                text
                    .setPlaceholder('')
                    .setValue(this.expirationDate)
                    .onChange(value => {
                        this.expirationDate = value;
                    });
                text.inputEl.type = 'date';
            });

        // Expiry type dropdown
        new Setting(contentEl)
            .setName('Expiry Type')
            .addDropdown(dropdown => {
                dropdown.addOption('', '-- Select --');
                for (const type of this.settings.expirationTypes) {
                    dropdown.addOption(type, type);
                }
                dropdown.setValue(this.expirationType);
                dropdown.onChange(value => {
                    this.expirationType = value as ExpiryType | '';
                });
            });

        // Buttons
        const buttonContainer = contentEl.createDiv('mise-modal-nav');

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const addBtn = buttonContainer.createEl('button', {
            text: 'Add Item',
            cls: 'mod-cta'
        });
        addBtn.onclick = () => this.doAdd(addBtn);
    }

    private async doAdd(button: HTMLButtonElement) {
        // Validate
        if (!this.itemName) {
            new Notice('Please enter an item name');
            return;
        }

        if (this.quantity <= 0) {
            new Notice('Please enter a valid quantity');
            return;
        }

        // Build the inventory item
        const item: InventoryItem = {
            name: this.itemName,
            quantity: this.quantity,
            unit: this.unit,
            category: this.category,
            location: this.location || this.category,
            purchaseDate: this.purchaseDate,
            expirationDate: this.expirationDate || undefined,
            expirationType: this.expirationType ? this.expirationType as ExpiryType : undefined,
        };

        // Show loading
        const originalText = button.textContent;
        button.textContent = 'Adding...';
        button.disabled = true;

        try {
            await this.inventoryService.addStock(item);
            // Add to ingredient index for future autocomplete
            await this.ingredientIndex.addIngredient(this.itemName, 'inventory');
            new Notice(`✅ Added ${this.quantity} ${this.unit} ${this.itemName}`);
            this.close();
            this.onSuccess();
        } catch (error: any) {
            console.error('AddInventoryModal: Failed to add item', error);
            new Notice(`❌ Failed to add item: ${error.message || 'Unknown error'}`);
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
