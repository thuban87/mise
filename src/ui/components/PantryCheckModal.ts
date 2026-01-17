/**
 * PantryCheckModal - Bulk inventory editing modal
 * 
 * Displays all inventory items grouped by location, allowing users to:
 * - Quickly adjust quantities
 * - Mark items as used up (delete)
 * - Add notes about expiration
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { MiseSettings, InventoryItem, InventoryCategory } from '../../types';
import { InventoryService } from '../../services/InventoryService';

export class PantryCheckModal extends Modal {
    private settings: MiseSettings;
    private inventoryService: InventoryService;
    private items: InventoryItem[] = [];
    private changes: Map<string, { quantity: number; delete: boolean }> = new Map();
    private filterCategory: InventoryCategory | 'All' = 'All';

    constructor(
        app: App,
        settings: MiseSettings,
        inventoryService: InventoryService
    ) {
        super(app);
        this.settings = settings;
        this.inventoryService = inventoryService;
    }

    async onOpen() {
        // Reload inventory from files to get fresh data
        await this.inventoryService.reload();

        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-pantry-check-modal');

        contentEl.createEl('h2', { text: '📋 Pantry Check' });

        contentEl.createEl('p', {
            text: 'Review and update your inventory. Adjust quantities or mark items as used.',
            cls: 'mise-modal-description'
        });

        // Filter by category
        new Setting(contentEl)
            .setName('Filter by')
            .addDropdown(dropdown => {
                dropdown.addOption('All', 'All Categories');
                dropdown.addOption('Pantry', '🏠 Pantry');
                dropdown.addOption('Fridge', '❄️ Fridge');
                dropdown.addOption('Freezer', '🧊 Freezer');
                dropdown.setValue(this.filterCategory);
                dropdown.onChange(async (value) => {
                    this.filterCategory = value as InventoryCategory | 'All';
                    await this.renderItems();
                });
            });

        // Item list container
        const itemsContainer = contentEl.createDiv('mise-pantry-items');
        itemsContainer.id = 'pantry-items-container';

        // Load and render items
        await this.renderItems();

        // Buttons
        const buttonContainer = contentEl.createDiv('mise-modal-nav');

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = buttonContainer.createEl('button', {
            text: 'Save Changes',
            cls: 'mod-cta'
        });
        saveBtn.onclick = () => this.saveChanges(saveBtn);
    }

    private async renderItems() {
        const container = this.contentEl.querySelector('#pantry-items-container');
        if (!container) return;
        container.empty();

        // Get items from service
        if (this.filterCategory === 'All') {
            this.items = this.inventoryService.getStock();
        } else {
            this.items = this.inventoryService.getStock(this.filterCategory);
        }

        if (this.items.length === 0) {
            container.createEl('p', {
                text: 'No inventory items found. Use "Add Inventory Item" to add some!',
                cls: 'mise-text-muted'
            });
            return;
        }

        // Group by location
        const byLocation = new Map<string, InventoryItem[]>();
        for (const item of this.items) {
            const loc = item.location || item.category;
            if (!byLocation.has(loc)) {
                byLocation.set(loc, []);
            }
            byLocation.get(loc)!.push(item);
        }

        // Render each location group
        for (const [location, locationItems] of byLocation.entries()) {
            const locationDiv = container.createDiv('mise-location-group');
            locationDiv.createEl('h4', { text: location });

            for (const item of locationItems) {
                this.renderItemRow(locationDiv, item);
            }
        }
    }

    private renderItemRow(container: HTMLElement, item: InventoryItem) {
        const itemKey = `${item.category}::${item.name}`;
        const existingChange = this.changes.get(itemKey);

        const rowDiv = container.createDiv('mise-inventory-item-row');
        rowDiv.style.display = 'flex';
        rowDiv.style.alignItems = 'center';
        rowDiv.style.gap = '10px';
        rowDiv.style.marginBottom = '8px';
        rowDiv.style.padding = '6px 8px';
        rowDiv.style.borderRadius = '4px';
        rowDiv.style.background = 'var(--background-secondary)';

        // Item name
        const nameSpan = rowDiv.createEl('span', { text: item.name });
        nameSpan.style.flex = '1';
        nameSpan.style.fontWeight = '500';

        // Quantity input
        const qtyInput = rowDiv.createEl('input', { type: 'number' });
        qtyInput.value = String(existingChange?.quantity ?? item.quantity);
        qtyInput.style.width = '60px';
        qtyInput.style.textAlign = 'center';
        qtyInput.min = '0';
        qtyInput.step = '0.1';
        qtyInput.onchange = () => {
            const newQty = parseFloat(qtyInput.value) || 0;
            this.changes.set(itemKey, {
                quantity: newQty,
                delete: newQty <= 0
            });
        };

        // Unit label
        rowDiv.createEl('span', { text: item.unit, cls: 'mise-text-muted' });

        // Delete button
        const deleteBtn = rowDiv.createEl('button', { text: '🗑️' });
        deleteBtn.title = 'Remove item';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = () => {
            this.changes.set(itemKey, { quantity: 0, delete: true });
            rowDiv.style.opacity = '0.4';
            rowDiv.style.textDecoration = 'line-through';
            qtyInput.disabled = true;
        };

        // Show expiration warning if soon
        if (item.expirationDate) {
            const expDate = new Date(item.expirationDate);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry <= 0) {
                rowDiv.style.borderLeft = '3px solid var(--color-red)';
                rowDiv.createEl('span', { text: '⚠️ Expired', cls: 'mise-text-muted' });
            } else if (daysUntilExpiry <= 7) {
                rowDiv.style.borderLeft = '3px solid var(--color-yellow)';
                rowDiv.createEl('span', { text: `⏰ ${daysUntilExpiry}d`, cls: 'mise-text-muted' });
            }
        }
    }

    private async saveChanges(button: HTMLButtonElement) {
        if (this.changes.size === 0) {
            new Notice('No changes to save');
            this.close();
            return;
        }

        button.textContent = 'Saving...';
        button.disabled = true;

        let updated = 0;
        let deleted = 0;

        try {
            for (const [itemKey, change] of this.changes.entries()) {
                const [category, name] = itemKey.split('::');

                if (change.delete || change.quantity <= 0) {
                    await this.inventoryService.removeItem(name);
                    deleted++;
                } else {
                    await this.inventoryService.setStock(name, change.quantity);
                    updated++;
                }
            }

            new Notice(`✅ Updated ${updated} items, removed ${deleted} items`);
            this.close();
        } catch (error: any) {
            console.error('PantryCheckModal: Error saving changes', error);
            new Notice(`❌ Error saving: ${error.message || 'Unknown error'}`);
            button.textContent = 'Save Changes';
            button.disabled = false;
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
