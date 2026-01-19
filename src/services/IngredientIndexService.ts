/**
 * IngredientIndexService - Global ingredient name index with aliases
 * 
 * Maintains a persistent index of all known ingredient names across:
 * - Current inventory items
 * - Recipe ingredients
 * - Historical meal log entries
 * 
 * Supports aliases for ingredient name normalization (e.g., "NY strip" -> "new york strip steak")
 */

import { App, TFile, normalizePath } from 'obsidian';
import { MiseSettings } from '../types';
import { normalizeIngredient } from '../parsers/IngredientParser';

/**
 * Represents an indexed ingredient with aliases
 */
export interface IndexedIngredient {
    /** Canonical name (lowercase, normalized) */
    name: string;

    /** Alternative names that map to this ingredient */
    aliases: string[];

    /** ISO date of last usage */
    lastUsed: string;

    /** Sources where this ingredient was found */
    sources: ('inventory' | 'recipe' | 'manual' | 'meal-log')[];
}

/**
 * Persistent index structure
 */
interface IngredientIndexData {
    version: number;
    ingredients: IndexedIngredient[];
}

const INDEX_VERSION = 1;
const INDEX_FILENAME = 'Ingredient Index.json';

export class IngredientIndexService {
    private app: App;
    private settings: MiseSettings;
    private ingredients: Map<string, IndexedIngredient> = new Map();
    private aliasMap: Map<string, string> = new Map(); // alias -> canonical name
    private isLoaded = false;

    constructor(app: App, settings: MiseSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Initialize the service - load from file and populate from sources
     */
    async initialize(
        inventoryItems: string[],
        recipeIngredients: string[]
    ): Promise<void> {
        await this.loadFromFile();

        // Auto-populate from inventory
        for (const item of inventoryItems) {
            this.addIngredientInternal(item, 'inventory');
        }

        // Auto-populate from recipes
        for (const ingredient of recipeIngredients) {
            // Extract just the ingredient name (strip quantity/unit)
            const name = this.extractIngredientName(ingredient);
            if (name) {
                this.addIngredientInternal(name, 'recipe');
            }
        }

        await this.saveToFile();
        this.isLoaded = true;
        console.log(`Mise: Loaded ${this.ingredients.size} indexed ingredients`);
    }

    /**
     * Update settings reference
     */
    updateSettings(settings: MiseSettings): void {
        this.settings = settings;
    }

    /**
     * Check if service is ready
     */
    isReady(): boolean {
        return this.isLoaded;
    }

    /**
     * Handle a recipe being added or updated - extract and index new ingredients
     */
    async handleRecipeUpdate(ingredients: string[]): Promise<void> {
        if (!this.isLoaded) return;

        let added = 0;
        for (const ingredient of ingredients) {
            const name = this.extractIngredientName(ingredient);
            if (name && !this.ingredients.has(normalizeIngredient(name))) {
                this.addIngredientInternal(name, 'recipe');
                added++;
            }
        }

        if (added > 0) {
            await this.saveToFile();
            console.log(`Mise: Added ${added} new ingredients from recipe`);
        }
    }

    /**
     * Get all indexed ingredients
     */
    getAllIngredients(): IndexedIngredient[] {
        return Array.from(this.ingredients.values());
    }

    /**
     * Search for ingredients matching a query
     * Returns matches sorted by relevance (exact match first, then starts-with, then contains)
     */
    search(query: string, limit: number = 10): IndexedIngredient[] {
        if (!query.trim()) {
            // Return most recently used when no query
            return Array.from(this.ingredients.values())
                .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
                .slice(0, limit);
        }

        const normalizedQuery = normalizeIngredient(query);
        const results: { ingredient: IndexedIngredient; score: number }[] = [];

        for (const ingredient of this.ingredients.values()) {
            const normalizedName = normalizeIngredient(ingredient.name);
            let score = 0;

            // Exact match
            if (normalizedName === normalizedQuery) {
                score = 100;
            }
            // Starts with query
            else if (normalizedName.startsWith(normalizedQuery)) {
                score = 80;
            }
            // Contains query
            else if (normalizedName.includes(normalizedQuery)) {
                score = 60;
            }
            // Check aliases
            else {
                for (const alias of ingredient.aliases) {
                    const normalizedAlias = normalizeIngredient(alias);
                    if (normalizedAlias === normalizedQuery) {
                        score = 90;
                        break;
                    } else if (normalizedAlias.startsWith(normalizedQuery)) {
                        score = 70;
                        break;
                    } else if (normalizedAlias.includes(normalizedQuery)) {
                        score = 50;
                        break;
                    }
                }
            }

            if (score > 0) {
                results.push({ ingredient, score });
            }
        }

        return results
            .sort((a, b) => b.score - a.score || a.ingredient.name.localeCompare(b.ingredient.name))
            .slice(0, limit)
            .map(r => r.ingredient);
    }

    /**
     * Find similar ingredients to a given name (for fuzzy match suggestions)
     * Returns ingredients that might be duplicates or variations
     * Only matches when there's significant WHOLE WORD overlap
     */
    findSimilar(name: string, threshold: number = 0.5): IndexedIngredient | null {
        if (!name.trim()) return null;

        const normalizedQuery = normalizeIngredient(name);
        if (!normalizedQuery) return null;

        // First, check if exact match exists - if so, no suggestion needed
        if (this.ingredients.has(normalizedQuery)) {
            return null;
        }

        const queryWords = new Set(normalizedQuery.split(/\s+/).filter(w => w.length > 2));
        if (queryWords.size === 0) return null;

        // Look for similar ingredients based on word overlap
        let bestMatch: { ingredient: IndexedIngredient; score: number } | null = null;

        for (const ingredient of this.ingredients.values()) {
            const normalizedName = normalizeIngredient(ingredient.name);
            const nameWords = new Set(normalizedName.split(/\s+/).filter(w => w.length > 2));

            if (nameWords.size === 0) continue;

            // Calculate word overlap (Jaccard similarity)
            const intersection = [...queryWords].filter(w => nameWords.has(w)).length;
            const union = new Set([...queryWords, ...nameWords]).size;
            const similarity = intersection / union;

            // Also check if the main word (longest) matches
            const queryMain = [...queryWords].sort((a, b) => b.length - a.length)[0];
            const nameMain = [...nameWords].sort((a, b) => b.length - a.length)[0];
            const mainWordMatch = queryMain === nameMain;

            // Boost score if main words match
            const finalScore = mainWordMatch ? Math.max(similarity, 0.8) : similarity;

            if (finalScore >= threshold && (!bestMatch || finalScore > bestMatch.score)) {
                bestMatch = { ingredient, score: finalScore };
            }
        }

        return bestMatch?.ingredient || null;
    }

    /**
     * Calculate similarity between two strings (0-1)
     * Simple approach: common word overlap
     */
    private calculateSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
        const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

        if (wordsA.size === 0 || wordsB.size === 0) {
            // For single short words, use character overlap
            const charsA = new Set(a);
            const charsB = new Set(b);
            const intersection = [...charsA].filter(c => charsB.has(c)).length;
            return intersection / Math.max(charsA.size, charsB.size);
        }

        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const union = new Set([...wordsA, ...wordsB]).size;

        return intersection / union;
    }

    /**
     * Add a new ingredient to the index
     */
    async addIngredient(name: string, source: IndexedIngredient['sources'][0]): Promise<void> {
        this.addIngredientInternal(name, source);
        await this.saveToFile();
    }

    /**
     * Internal add without save (for batch operations)
     */
    private addIngredientInternal(name: string, source: IndexedIngredient['sources'][0]): void {
        const normalizedName = normalizeIngredient(name);
        if (!normalizedName) return;

        const existing = this.ingredients.get(normalizedName);
        if (existing) {
            // Update last used and add source if new
            existing.lastUsed = new Date().toISOString().split('T')[0];
            if (!existing.sources.includes(source)) {
                existing.sources.push(source);
            }
        } else {
            // Create new entry
            this.ingredients.set(normalizedName, {
                name: name.trim().toLowerCase(),
                aliases: [],
                lastUsed: new Date().toISOString().split('T')[0],
                sources: [source],
            });
        }
    }

    /**
     * Add an alias for an ingredient
     */
    async addAlias(ingredientName: string, alias: string): Promise<boolean> {
        const normalizedName = normalizeIngredient(ingredientName);
        const normalizedAlias = normalizeIngredient(alias);

        if (!normalizedName || !normalizedAlias) return false;

        const ingredient = this.ingredients.get(normalizedName);
        if (!ingredient) {
            // Create the ingredient if it doesn't exist
            this.addIngredientInternal(ingredientName, 'manual');
        }

        const target = this.ingredients.get(normalizedName)!;

        // Check if alias already exists for another ingredient
        const existingTarget = this.aliasMap.get(normalizedAlias);
        if (existingTarget && existingTarget !== normalizedName) {
            console.warn(`Mise: Alias "${alias}" already maps to "${existingTarget}"`);
            return false;
        }

        // Add alias if not already present
        if (!target.aliases.some(a => normalizeIngredient(a) === normalizedAlias)) {
            target.aliases.push(alias.trim().toLowerCase());
            this.aliasMap.set(normalizedAlias, normalizedName);
            await this.saveToFile();
        }

        return true;
    }

    /**
     * Remove an alias from an ingredient
     */
    async removeAlias(ingredientName: string, alias: string): Promise<boolean> {
        const normalizedName = normalizeIngredient(ingredientName);
        const normalizedAlias = normalizeIngredient(alias);

        const ingredient = this.ingredients.get(normalizedName);
        if (!ingredient) return false;

        const index = ingredient.aliases.findIndex(a => normalizeIngredient(a) === normalizedAlias);
        if (index === -1) return false;

        ingredient.aliases.splice(index, 1);
        this.aliasMap.delete(normalizedAlias);
        await this.saveToFile();

        return true;
    }

    /**
     * Find the canonical ingredient name from a name or alias
     * Handles raw recipe strings like "New York strip steak (boneless or bone-in)"
     * Returns null if not found
     */
    findCanonicalName(nameOrAlias: string): string | null {
        // First, extract the ingredient name (strips qty, units, parentheticals, prep words)
        const extracted = this.extractIngredientName(nameOrAlias);
        const normalized = normalizeIngredient(extracted);
        if (!normalized) return null;

        // Direct match
        if (this.ingredients.has(normalized)) {
            return this.ingredients.get(normalized)!.name;
        }

        // Alias match
        const canonical = this.aliasMap.get(normalized);
        if (canonical && this.ingredients.has(canonical)) {
            return this.ingredients.get(canonical)!.name;
        }

        // Fuzzy match - check if query is contained in or contains an ingredient name
        for (const [key, ingredient] of this.ingredients) {
            if (key.includes(normalized) || normalized.includes(key)) {
                return ingredient.name;
            }
            // Check aliases
            for (const alias of ingredient.aliases) {
                const normalizedAlias = normalizeIngredient(alias);
                if (normalizedAlias.includes(normalized) || normalized.includes(normalizedAlias)) {
                    return ingredient.name;
                }
            }
        }

        return null;
    }

    /**
     * Get ingredient by canonical name
     */
    getIngredient(name: string): IndexedIngredient | null {
        const normalized = normalizeIngredient(name);
        return this.ingredients.get(normalized) || null;
    }

    /**
     * Remove an ingredient from the index
     */
    async removeIngredient(name: string): Promise<boolean> {
        const normalized = normalizeIngredient(name);
        const ingredient = this.ingredients.get(normalized);

        if (!ingredient) return false;

        // Remove all aliases
        for (const alias of ingredient.aliases) {
            this.aliasMap.delete(normalizeIngredient(alias));
        }

        this.ingredients.delete(normalized);
        await this.saveToFile();

        return true;
    }

    /**
     * Merge two ingredients (combine aliases, keep first as canonical)
     */
    async mergeIngredients(primaryName: string, secondaryName: string): Promise<boolean> {
        const primaryNorm = normalizeIngredient(primaryName);
        const secondaryNorm = normalizeIngredient(secondaryName);

        const primary = this.ingredients.get(primaryNorm);
        const secondary = this.ingredients.get(secondaryNorm);

        if (!primary || !secondary) return false;

        // Add secondary name as alias to primary
        if (!primary.aliases.some(a => normalizeIngredient(a) === secondaryNorm)) {
            primary.aliases.push(secondary.name);
            this.aliasMap.set(secondaryNorm, primaryNorm);
        }

        // Move all secondary aliases to primary
        for (const alias of secondary.aliases) {
            const normalizedAlias = normalizeIngredient(alias);
            if (!primary.aliases.some(a => normalizeIngredient(a) === normalizedAlias)) {
                primary.aliases.push(alias);
                this.aliasMap.set(normalizedAlias, primaryNorm);
            }
        }

        // Merge sources
        for (const source of secondary.sources) {
            if (!primary.sources.includes(source)) {
                primary.sources.push(source);
            }
        }

        // Update last used
        if (secondary.lastUsed > primary.lastUsed) {
            primary.lastUsed = secondary.lastUsed;
        }

        // Remove secondary
        this.ingredients.delete(secondaryNorm);
        await this.saveToFile();

        return true;
    }

    // =========================================================================
    // Persistence
    // =========================================================================

    /**
     * Get the index file path
     */
    private getIndexPath(): string {
        return normalizePath(`${this.settings.inventoryFolder}/${INDEX_FILENAME}`);
    }

    /**
     * Load index from file
     */
    private async loadFromFile(): Promise<void> {
        const filePath = this.getIndexPath();
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (!file || !(file instanceof TFile)) {
            // No existing index
            return;
        }

        try {
            const content = await this.app.vault.read(file);
            const data: IngredientIndexData = JSON.parse(content);

            if (data.version !== INDEX_VERSION) {
                console.log('Mise: Ingredient index version mismatch, will rebuild');
                return;
            }

            // Populate maps
            for (const ingredient of data.ingredients) {
                const normalized = normalizeIngredient(ingredient.name);
                this.ingredients.set(normalized, ingredient);

                // Build alias map
                for (const alias of ingredient.aliases) {
                    this.aliasMap.set(normalizeIngredient(alias), normalized);
                }
            }
        } catch (e) {
            console.error('Mise: Failed to load ingredient index', e);
        }
    }

    /**
     * Save index to file
     */
    private async saveToFile(): Promise<void> {
        const filePath = this.getIndexPath();
        const data: IngredientIndexData = {
            version: INDEX_VERSION,
            ingredients: Array.from(this.ingredients.values()),
        };
        const content = JSON.stringify(data, null, 2);

        // Ensure folder exists
        const folderPath = this.settings.inventoryFolder;
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    /**
     * Common preparation/modifier words to strip from ingredient names
     */
    private static readonly PREP_WORDS = [
        'minced', 'diced', 'chopped', 'sliced', 'crushed', 'grated', 'shredded',
        'peeled', 'cubed', 'halved', 'quartered', 'whole', 'fresh', 'dried',
        'ground', 'powdered', 'melted', 'softened', 'chilled', 'cold', 'warm',
        'hot', 'room temperature', 'cooked', 'uncooked', 'raw', 'frozen',
        'thawed', 'canned', 'drained', 'rinsed', 'packed', 'loosely packed',
        'firmly packed', 'sifted', 'unsifted', 'divided', 'plus more',
        'to taste', 'for garnish', 'for serving', 'optional', 'or more',
        'as needed', 'if desired', 'pureed', 'mashed', 'beaten', 'whisked',
        'separated', 'at room temperature', 'finely', 'coarsely', 'thinly',
        'thickly', 'roughly', 'julienned', 'zested', 'juiced', 'seeded',
        'deveined', 'trimmed', 'washed', 'cleaned', 'torn', 'crumbled',
        'boneless', 'bone-in', 'skinless', 'skin-on', 'thick-cut', 'thin-cut'
    ];

    /**
     * Extract ingredient name from full ingredient string (strip quantity/unit/notes)
     * "2 cups flour" -> "flour"
     * "1/2 tsp salt, divided" -> "salt"
     * "1 lb new york strip steak (boneless or bone-in)" -> "new york strip steak"
     */
    private extractIngredientName(ingredientStr: string): string {
        let remaining = ingredientStr.trim();

        // Remove quantity at start (numbers, fractions, decimals)
        remaining = remaining.replace(/^[\d\s\/⁄.,]+/, '').trim();

        // Remove common units at start
        const units = [
            'cups?', 'c\\.?',
            'tablespoons?', 'tbsp\\.?', 'tbs\\.?', 'tb\\.?',
            'teaspoons?', 'tsp\\.?', 'ts\\.?',
            'pounds?', 'lbs?\\.?',
            'ounces?', 'oz\\.?',
            'grams?', 'g\\.?',
            'kilograms?', 'kg\\.?',
            'pints?', 'pt\\.?',
            'quarts?', 'qt\\.?',
            'gallons?', 'gal\\.?',
            'milliliters?', 'ml\\.?',
            'liters?', 'l\\.?',
            'pieces?', 'pcs?\\.?',
            'slices?',
            'cloves?',
            'cans?',
            'packages?', 'pkgs?\\.?',
            'bunche?s?',
            'sprigs?',
            'pinche?s?',
            'dashe?s?',
            'heads?',
            'stalks?',
            'sticks?',
            'small', 'medium', 'large',
        ];

        const unitPattern = new RegExp(`^(${units.join('|')})\\s+`, 'i');
        remaining = remaining.replace(unitPattern, '').trim();

        // Remove "of" at start (e.g., "2 cups of flour" -> already processed to "of flour")
        remaining = remaining.replace(/^of\s+/i, '').trim();

        // Remove parenthetical notes: "(boneless or bone-in)", "(about 2 cups)", etc.
        remaining = remaining.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

        // Remove trailing comma-separated notes: "salt, divided" -> "salt"
        remaining = remaining.replace(/,\s+.*$/, '').trim();

        // Remove trailing prep words
        for (const word of IngredientIndexService.PREP_WORDS) {
            // Remove whole word at end
            const endPattern = new RegExp(`\\s+${word}$`, 'gi');
            remaining = remaining.replace(endPattern, '').trim();
            // Remove at start too
            const startPattern = new RegExp(`^${word}\\s+`, 'gi');
            remaining = remaining.replace(startPattern, '').trim();
        }

        // Clean up any double spaces
        remaining = remaining.replace(/\s+/g, ' ').trim();

        return remaining.toLowerCase();
    }
}
