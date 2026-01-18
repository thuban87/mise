/**
 * ThrowAwayModal - Modal for logging food waste
 * 
 * Features:
 * - Inventory item autocomplete
 * - Quantity input with unit
 * - Reason selection (Expired, Spoiled, Didn't Like, Made Too Much, Other)
 * - Fillable "Other" reason
 * - Deducts from inventory
 * - Logs to Waste Log.md
 * - Updates Foods I Don't Like.md for "Didn't Like" entries
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { MiseSettings, InventoryItem } from '../../types';
import { InventoryService } from '../../services/InventoryService';
import type MisePlugin from '../../main';

const WASTE_REASONS = [
    'Expired',
    'Spoiled',
    "Didn't Like",
    'Made Too Much',
    'Other'
] as const;

type WasteReason = typeof WASTE_REASONS[number];

export class ThrowAwayModal extends Modal {
    private settings: MiseSettings;
    private inventoryService: InventoryService;
    private plugin: MisePlugin;

    private selectedItem: InventoryItem | null = null;
    private quantity: number = 1;
    private unit: string = 'oz';
    private reason: WasteReason = 'Expired';
    private otherReason: string = '';

    constructor(
        plugin: MisePlugin
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.settings = plugin.settings;
        this.inventoryService = plugin.inventoryService;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-throw-away-modal');

        contentEl.createEl('h2', { text: '🗑️ Threw Away Food' });

        const allItems = this.inventoryService.getStock();

        // Item selection with autocomplete
        new Setting(contentEl)
            .setName('Item')
            .setDesc('Select from inventory')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'Select item...');
                for (const item of allItems) {
                    const label = `${item.name} (${item.quantity} ${item.unit} - ${item.category})`;
                    dropdown.addOption(item.name, label);
                }
                dropdown.onChange(value => {
                    this.selectedItem = allItems.find(i => i.name === value) || null;
                    if (this.selectedItem) {
                        this.unit = this.selectedItem.unit;
                        this.quantity = Math.min(1, this.selectedItem.quantity);
                        this.render(); // Re-render to update quantity/unit
                    }
                });
            });

        // Quantity
        new Setting(contentEl)
            .setName('Quantity')
            .setDesc('How much was thrown away')
            .addText(text => text
                .setPlaceholder('1')
                .setValue(String(this.quantity))
                .onChange(value => {
                    this.quantity = parseFloat(value) || 0;
                }))
            .addDropdown(dropdown => {
                const units = ['oz', 'lb', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'each', 'can', 'bottle'];
                for (const u of units) {
                    dropdown.addOption(u, u);
                }
                dropdown.setValue(this.unit);
                dropdown.onChange(value => {
                    this.unit = value;
                });
            });

        // Reason
        const reasonSetting = new Setting(contentEl)
            .setName('Reason')
            .setDesc('Why was it thrown away?')
            .addDropdown(dropdown => {
                for (const r of WASTE_REASONS) {
                    dropdown.addOption(r, r);
                }
                dropdown.setValue(this.reason);
                dropdown.onChange(value => {
                    this.reason = value as WasteReason;
                    this.render(); // Re-render to show/hide other reason input
                });
            });

        // Other reason input (shown only when "Other" is selected)
        if (this.reason === 'Other') {
            new Setting(contentEl)
                .setName('Specify reason')
                .addText(text => text
                    .setPlaceholder('Enter reason...')
                    .setValue(this.otherReason)
                    .onChange(value => {
                        this.otherReason = value;
                    }));
        }

        // Action buttons
        const buttonContainer = contentEl.createDiv('mise-modal-actions');

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel', cls: 'mise-btn mise-btn-secondary' });
        cancelBtn.onclick = () => this.close();

        const confirmBtn = buttonContainer.createEl('button', { text: '🗑️ Log Waste', cls: 'mise-btn mise-btn-primary' });
        confirmBtn.disabled = !this.selectedItem;
        confirmBtn.onclick = () => this.logWaste(confirmBtn);
    }

    private render() {
        this.onOpen(); // Simple re-render
    }

    private async logWaste(button: HTMLButtonElement) {
        if (!this.selectedItem || this.quantity <= 0) {
            new Notice('Please select an item and quantity');
            return;
        }

        button.disabled = true;
        button.textContent = 'Logging...';

        try {
            const finalReason = this.reason === 'Other' ? this.otherReason : this.reason;

            // 1. Deduct from inventory
            await this.inventoryService.deductStock(
                this.selectedItem.name,
                this.quantity,
                this.unit
            );

            // 2. Write to Waste Log
            await this.writeWasteLog(this.selectedItem.name, this.quantity, this.unit, finalReason);

            // 3. If "Didn't Like", add to Foods I Don't Like
            if (this.reason === "Didn't Like") {
                await this.addToDislikedFoods(this.selectedItem.name, finalReason);
            }
            // 4. Refresh status bar alerts
            if (this.plugin.statusBar) {
                this.plugin.statusBar.checkAlerts();
            }

            new Notice(`✅ Logged: ${this.quantity} ${this.unit} ${this.selectedItem.name} (${finalReason})`);
            this.close();

        } catch (error: any) {
            console.error('ThrowAwayModal: Error logging waste', error);
            new Notice(`❌ Error: ${error.message || 'Unknown error'}`);
            button.textContent = '🗑️ Log Waste';
            button.disabled = false;
        }
    }

    private async writeWasteLog(name: string, quantity: number, unit: string, reason: string) {
        const logPath = `${this.settings.inventoryFolder}/Waste Log.md`;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const qtyStr = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(2);
        const entry = `\n| ${dateStr} | ${timeStr} | ${name} | ${qtyStr} ${unit} | ${reason} |\n`;

        let file = this.app.vault.getAbstractFileByPath(logPath);

        if (!file) {
            // Create file with header
            const header = `# Waste Log

> [!NOTE]
> Food waste tracked through Mise. Use this to identify patterns and reduce waste.

| Date | Time | Item | Amount | Reason |
|------|------|------|--------|--------|
`;
            await this.app.vault.create(logPath, header + entry);
        } else {
            const content = await this.app.vault.read(file as any);
            await this.app.vault.modify(file as any, content + entry);
        }
    }

    private async addToDislikedFoods(name: string, reason: string) {
        const dislikedPath = `${this.settings.inventoryFolder}/Foods I Don't Like.md`;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        let file = this.app.vault.getAbstractFileByPath(dislikedPath);

        if (!file) {
            // Create file with header
            const header = `# Foods I Don't Like

> [!NOTE]
> Auto-populated from waste log entries marked "Didn't Like". 
> Reference when meal planning to avoid recipes with these ingredients.

| Date | Item | Notes |
|------|------|-------|
`;
            const entry = `| ${dateStr} | ${name} | ${reason || 'Added from waste log'} |\n`;
            await this.app.vault.create(dislikedPath, header + entry);
        } else {
            const content = await this.app.vault.read(file as any);

            // Check if already in list
            if (!content.includes(`| ${name} |`) && !content.toLowerCase().includes(`| ${name.toLowerCase()} |`)) {
                const entry = `| ${dateStr} | ${name} | ${reason || 'Added from waste log'} |\n`;
                await this.app.vault.modify(file as any, content + entry);
            }
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
