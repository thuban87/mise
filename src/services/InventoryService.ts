/**
 * InventoryService - Manage kitchen inventory across category files
 * 
 * Handles reading/writing inventory from markdown table files:
 * - Inventory - Pantry.md
 * - Inventory - Fridge.md
 * - Inventory - Freezer.md
 * 
 * Also generates a read-only aggregated Inventory.md master file.
 */

import { App, TFile, TFolder } from 'obsidian';
import {
    MiseSettings,
    InventoryItem,
    InventoryCategory
} from '../types';
import { normalizeIngredient } from '../parsers/IngredientParser';

// Category file mapping
const CATEGORY_FILES: Record<InventoryCategory, string> = {
    'Pantry': 'Inventory - Pantry.md',
    'Fridge': 'Inventory - Fridge.md',
    'Freezer': 'Inventory - Freezer.md',
};

// Table header for inventory files
const TABLE_HEADER = '| Item | Qty | Unit | Location | Purchased | Expires | Expiry Type |\n|------|-----|------|----------|-----------|---------|-------------|';

export class InventoryService {
    private app: App;
    private settings: MiseSettings;
    private inventory: Map<string, InventoryItem> = new Map();
    private isLoaded = false;

    constructor(app: App, settings: MiseSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Initialize the service - load inventory from all category files
     */
    async initialize(): Promise<void> {
        await this.loadAllInventory();
        await this.generateMasterInventory();
        this.isLoaded = true;
        console.log(`Mise: Loaded ${this.inventory.size} inventory items`);
    }

    /**
     * Update settings reference (called when settings change)
     */
    updateSettings(settings: MiseSettings): void {
        this.settings = settings;
    }

    /**
     * Reload inventory from files (useful for getting fresh data)
     */
    async reload(): Promise<void> {
        await this.loadAllInventory();
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isLoaded;
    }

    /**
     * Get all inventory items, optionally filtered by category
     */
    getStock(category?: InventoryCategory): InventoryItem[] {
        const items = Array.from(this.inventory.values());
        if (category) {
            return items.filter(item => item.category === category);
        }
        return items;
    }

    /**
     * Find inventory item by name using fuzzy matching
     */
    findItem(name: string): InventoryItem | null {
        const normalizedSearch = normalizeIngredient(name);

        // Exact match first
        for (const item of this.inventory.values()) {
            if (normalizeIngredient(item.name) === normalizedSearch) {
                return item;
            }
        }

        // Fuzzy match - check if search term is contained in item name
        for (const item of this.inventory.values()) {
            const normalizedItem = normalizeIngredient(item.name);
            if (normalizedItem.includes(normalizedSearch) ||
                normalizedSearch.includes(normalizedItem)) {
                return item;
            }
        }

        return null;
    }

    /**
     * Add a new item to inventory
     */
    async addStock(item: InventoryItem): Promise<boolean> {
        // Normalize the name
        const normalizedName = normalizeIngredient(item.name);
        const key = this.getItemKey(item.name, item.category);

        // Check for existing item
        const existing = this.findItem(item.name);
        if (existing && existing.category === item.category) {
            // Convert units if different, then add to existing quantity
            let addAmount = item.quantity;
            if (existing.unit !== item.unit) {
                const converted = this.convertUnits(item.quantity, item.unit, existing.unit, item.name);
                if (converted !== null) {
                    addAmount = converted;
                } else {
                    console.warn(`Mise: Can't convert ${item.quantity} ${item.unit} to ${existing.unit} for ${item.name}`);
                }
            }
            existing.quantity += addAmount;
            this.inventory.set(this.getItemKey(existing.name, existing.category), existing);
        } else {
            // Add new item  
            this.inventory.set(key, {
                ...item,
                name: item.name.trim(),
            });
        }

        await this.saveCategoryFile(item.category);
        await this.generateMasterInventory();
        return true;
    }

    /**
     * Deduct quantity from inventory
     * Uses fuzzy matching and handles unit conversion
     * @returns Actual amount deducted (may be less if insufficient stock)
     */
    async deductStock(
        itemName: string,
        quantity: number,
        unit: string
    ): Promise<{ deducted: number; remaining: number; found: boolean }> {
        const item = this.findItem(itemName);

        if (!item) {
            return { deducted: 0, remaining: 0, found: false };
        }

        // Handle unit conversion if needed
        let deductAmount = quantity;
        if (item.unit !== unit) {
            const converted = this.convertUnits(quantity, unit, item.unit, itemName);
            if (converted !== null) {
                deductAmount = converted;
            } else {
                // Can't convert - log warning and use raw value
                console.warn(`Mise: Can't convert ${quantity} ${unit} to ${item.unit} for ${itemName}`);
            }
        }

        const actualDeducted = Math.min(deductAmount, item.quantity);
        item.quantity = Math.max(0, item.quantity - deductAmount);

        // Remove item if quantity is 0
        if (item.quantity <= 0) {
            this.inventory.delete(this.getItemKey(item.name, item.category));
        }

        await this.saveCategoryFile(item.category);
        await this.generateMasterInventory();

        return {
            deducted: actualDeducted,
            remaining: item.quantity,
            found: true
        };
    }

    /**
     * Set exact quantity for an item (for manual corrections)
     */
    async setStock(itemName: string, quantity: number): Promise<boolean> {
        const item = this.findItem(itemName);

        if (!item) {
            return false;
        }

        item.quantity = quantity;

        if (quantity <= 0) {
            this.inventory.delete(this.getItemKey(item.name, item.category));
        }

        await this.saveCategoryFile(item.category);
        await this.generateMasterInventory();
        return true;
    }

    /**
     * Remove an item completely from inventory
     */
    async removeItem(itemName: string): Promise<boolean> {
        const item = this.findItem(itemName);

        if (!item) {
            return false;
        }

        const category = item.category;
        this.inventory.delete(this.getItemKey(item.name, item.category));

        await this.saveCategoryFile(category);
        await this.generateMasterInventory();
        return true;
    }

    // =========================================================================
    // File I/O
    // =========================================================================

    /**
     * Load inventory from all category files
     */
    private async loadAllInventory(): Promise<void> {
        this.inventory.clear();

        for (const category of Object.keys(CATEGORY_FILES) as InventoryCategory[]) {
            await this.loadCategoryFile(category);
        }
    }

    /**
     * Load a single category file
     */
    private async loadCategoryFile(category: InventoryCategory): Promise<void> {
        const filePath = `${this.settings.inventoryFolder}/${CATEGORY_FILES[category]}`;
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (!file || !(file instanceof TFile)) {
            // File doesn't exist - will be created on first add
            return;
        }

        const content = await this.app.vault.read(file);
        const items = this.parseInventoryTable(content, category);

        for (const item of items) {
            this.inventory.set(this.getItemKey(item.name, category), item);
        }
    }

    /**
     * Save a category file
     */
    private async saveCategoryFile(category: InventoryCategory): Promise<void> {
        const filePath = `${this.settings.inventoryFolder}/${CATEGORY_FILES[category]}`;
        const items = this.getStock(category);
        const content = this.generateCategoryFileContent(category, items);

        // Ensure folder exists
        await this.ensureFolderExists(this.settings.inventoryFolder);

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    /**
     * Generate the master inventory file (aggregated, read-only mirror)
     */
    async generateMasterInventory(): Promise<void> {
        const filePath = `${this.settings.inventoryFolder}/Inventory.md`;
        const allItems = this.getStock();

        let content = `# Kitchen Inventory\n\n`;
        content += `> [!NOTE]\n`;
        content += `> This file is auto-generated by Mise. Do not edit directly.\n`;
        content += `> Last updated: ${new Date().toISOString().split('T')[0]}\n`;
        content += `> \n`;
        content += `> **To delete items:** Edit the category files (Inventory - Pantry/Fridge/Freezer.md)\n`;
        content += `> and delete item rows. Leave table headers intact. To clear everything,\n`;
        content += `> delete all 4 inventory files - they'll be recreated on next add.\n\n`;
        content += `**Total items:** ${allItems.length}\n\n`;

        // Group by category
        for (const category of Object.keys(CATEGORY_FILES) as InventoryCategory[]) {
            const categoryItems = allItems.filter(i => i.category === category);
            if (categoryItems.length === 0) continue;

            content += `## ${category}\n\n`;
            content += TABLE_HEADER + '\n';

            for (const item of categoryItems.sort((a, b) => a.name.localeCompare(b.name))) {
                content += this.itemToTableRow(item) + '\n';
            }
            content += '\n';
        }

        // Ensure folder exists
        await this.ensureFolderExists(this.settings.inventoryFolder);

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    // =========================================================================
    // Parsing & Formatting
    // =========================================================================

    /**
     * Parse inventory items from markdown table content
     */
    private parseInventoryTable(content: string, category: InventoryCategory): InventoryItem[] {
        const items: InventoryItem[] = [];
        const lines = content.split('\n');

        let inTable = false;
        for (const line of lines) {
            // Skip header and separator rows
            if (line.startsWith('| Item') || line.startsWith('|---')) {
                inTable = true;
                continue;
            }

            if (!inTable || !line.startsWith('|')) {
                if (inTable && !line.trim()) {
                    inTable = false; // End of table
                }
                continue;
            }

            const item = this.parseTableRow(line, category);
            if (item) {
                items.push(item);
            }
        }

        return items;
    }

    /**
     * Parse a single table row into an InventoryItem
     */
    private parseTableRow(line: string, category: InventoryCategory): InventoryItem | null {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);

        if (cells.length < 4) return null;

        const [name, qtyStr, unit, location, purchased, expires, expiryType] = cells;
        const quantity = parseFloat(qtyStr) || 0;

        if (!name || quantity <= 0) return null;

        return {
            name,
            quantity,
            unit: unit || 'count',
            category,
            location: location || category,
            purchaseDate: purchased || new Date().toISOString().split('T')[0],
            expirationDate: expires || undefined,
            expirationType: this.parseExpiryType(expiryType),
        };
    }

    /**
     * Convert InventoryItem to table row
     */
    private itemToTableRow(item: InventoryItem): string {
        const expiry = item.expirationDate || '-';
        const expiryType = item.expirationType || '-';
        return `| ${item.name} | ${item.quantity} | ${item.unit} | ${item.location} | ${item.purchaseDate} | ${expiry} | ${expiryType} |`;
    }

    /**
     * Generate content for a category file
     */
    private generateCategoryFileContent(category: InventoryCategory, items: InventoryItem[]): string {
        let content = `# ${category} Inventory\n\n`;
        content += TABLE_HEADER + '\n';

        for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
            content += this.itemToTableRow(item) + '\n';
        }

        return content;
    }

    /**
     * Parse expiry type string
     */
    private parseExpiryType(str: string | undefined): InventoryItem['expirationType'] {
        if (!str || str === '-') return undefined;
        const normalized = str.toLowerCase().trim();
        if (normalized.includes('best')) return 'Best By';
        if (normalized.includes('use')) return 'Use By';
        if (normalized.includes('sell')) return 'Sell By';
        if (normalized.includes('expir')) return 'Expires';
        return undefined;
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /**
     * Generate unique key for inventory item
     */
    private getItemKey(name: string, category: InventoryCategory): string {
        return `${category}::${normalizeIngredient(name)}`;
    }

    /**
     * Convert between units (basic implementation)
     * Returns null if conversion not possible
     */
    private convertUnits(
        value: number,
        fromUnit: string,
        toUnit: string,
        ingredient: string
    ): number | null {
        const from = fromUnit.toLowerCase();
        const to = toUnit.toLowerCase();

        // Same unit family conversions
        const volumeUnits: Record<string, number> = {
            'tsp': 1,
            'tbsp': 3,
            'cup': 48,
            'cups': 48,
            'fl oz': 6,
            'pint': 96,
            'quart': 192,
        };

        const weightUnits: Record<string, number> = {
            'oz': 1,
            'lb': 16,
            'lbs': 16,
            'pound': 16,
            'pounds': 16,
            'g': 0.035274,
            'kg': 35.274,
        };

        // Volume to volume
        if (volumeUnits[from] !== undefined && volumeUnits[to] !== undefined) {
            return (value * volumeUnits[from]) / volumeUnits[to];
        }

        // Weight to weight
        if (weightUnits[from] !== undefined && weightUnits[to] !== undefined) {
            return (value * weightUnits[from]) / weightUnits[to];
        }

        // Cross-unit conversion (volume ↔ weight) using simple 8 oz per cup ratio
        // This is a practical approximation that works well for most ingredients
        const isFromVolume = volumeUnits[from] !== undefined;
        const isToWeight = weightUnits[to] !== undefined;
        const isFromWeight = weightUnits[from] !== undefined;
        const isToVolume = volumeUnits[to] !== undefined;

        if (isFromVolume && isToWeight) {
            // Convert volume to cups first, then to oz (8 oz per cup)
            const cups = (value * volumeUnits[from]) / volumeUnits['cup'];
            const oz = cups * 8; // 8 oz per cup approximation
            return (oz * weightUnits['oz']) / weightUnits[to];
        }

        if (isFromWeight && isToVolume) {
            // Convert weight to oz first, then to cups (8 oz per cup)
            const oz = (value * weightUnits[from]) / weightUnits['oz'];
            const cups = oz / 8; // 8 oz per cup approximation
            return (cups * volumeUnits['cup']) / volumeUnits[to];
        }

        return null;
    }

    /**
     * Ensure a folder exists, creating it if necessary
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }
}
