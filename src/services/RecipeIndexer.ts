/**
 * RecipeIndexer Service
 * 
 * Real-time background indexing of recipe files in the vault.
 * Replaces the external Python script with native Obsidian integration.
 */

import { App, TFile, TFolder, Events, EventRef } from 'obsidian';
import { Recipe, MiseSettings, RecipeCategory, DietaryFlag } from '../types';
import { parseIngredients } from '../parsers/IngredientParser';
import { parseTime, parseCategory, parseRating, parseDietaryFlags } from '../parsers/FrontmatterParser';
import { debounce } from '../utils/helpers';
import { PLUGIN_NAME } from '../utils/constants';

// Set to true for verbose logging during development
const DEBUG = false;

export class RecipeIndexer extends Events {
    private app: App;
    private settings: MiseSettings;
    private recipes: Map<string, Recipe> = new Map();
    private eventRefs: EventRef[] = [];
    private isInitialized = false;

    constructor(app: App, settings: MiseSettings) {
        super();
        this.app = app;
        this.settings = settings;
    }

    /**
     * Initialize the indexer and perform initial scan
     */
    async initialize(): Promise<void> {
        const startTime = performance.now();

        // Perform initial scan
        await this.scanVault();

        // Set up file watchers
        this.registerEventHandlers();

        this.isInitialized = true;
        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`${PLUGIN_NAME}: Indexed ${this.recipes.size} recipes in ${elapsed}ms`);

        // Emit ready event
        this.trigger('index-ready', { count: this.recipes.size });
    }

    /**
     * Scan the vault for all recipe files
     */
    async scanVault(): Promise<void> {
        const recipesFolder = this.settings.recipesFolder;
        const folder = this.app.vault.getAbstractFileByPath(recipesFolder);

        if (!folder || !(folder instanceof TFolder)) {
            console.warn(`${PLUGIN_NAME}: Recipes folder not found: ${recipesFolder}`);
            return;
        }

        // Get all markdown files in the recipes folder
        const files = this.getMarkdownFilesRecursive(folder);

        for (const file of files) {
            const recipe = await this.buildRecipeFromFile(file);
            if (recipe) {
                this.recipes.set(file.path, recipe);
            }
        }
    }

    /**
     * Recursively get all markdown files in a folder
     */
    private getMarkdownFilesRecursive(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getMarkdownFilesRecursive(child));
            }
        }

        return files;
    }

    /**
     * Build a Recipe object from a file
     */
    private async buildRecipeFromFile(file: TFile): Promise<Recipe | null> {
        try {
            // Use metadataCache for frontmatter (much faster than re-parsing)
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};

            // Read file content for ingredients parsing
            const content = await this.app.vault.cachedRead(file);

            const recipe: Recipe = {
                path: file.path,
                title: this.extractTitle(file, frontmatter, content),
                folder: file.parent?.name || '',
                category: parseCategory(frontmatter.category),
                tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                rating: parseRating(frontmatter.rating),
                servings: String(frontmatter.servings || ''),
                prepTime: parseTime(frontmatter.prep_time),
                cookTime: parseTime(frontmatter.cook_time),
                source: frontmatter.source || null,
                image: frontmatter.image || null,
                dietaryFlags: parseDietaryFlags(frontmatter.dietary_flags || frontmatter.dietaryFlags),
                ingredients: parseIngredients(content),
                lastModified: file.stat.mtime,
            };

            // Add nutrition if present
            if (frontmatter.calories || frontmatter.protein || frontmatter.carbs || frontmatter.fat) {
                recipe.nutrition = {
                    calories: frontmatter.calories,
                    protein: frontmatter.protein,
                    carbs: frontmatter.carbs,
                    fat: frontmatter.fat,
                    fiber: frontmatter.fiber,
                };
            }

            return recipe;
        } catch (error) {
            console.error(`${PLUGIN_NAME}: Error parsing recipe ${file.path}:`, error);
            return null;
        }
    }

    /**
     * Extract title from file (prefer H1, fall back to frontmatter title, then filename)
     */
    private extractTitle(file: TFile, frontmatter: Record<string, any>, content: string): string {
        // Try frontmatter title first
        if (frontmatter.title) {
            return frontmatter.title;
        }

        // Try to find H1 in content
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }

        // Fall back to filename without extension
        return file.basename;
    }

    /**
     * Register vault event handlers
     */
    private registerEventHandlers(): void {
        // Debounced handler for rapid changes
        const debouncedModify = debounce((file: TFile) => {
            this.handleFileModify(file);
        }, 300);

        // File created - only handle if indexer is already initialized
        // (files detected during initial scan are not "created", they're scanned)
        const createRef = this.app.vault.on('create', (file) => {
            if (file instanceof TFile && this.isRecipeFile(file) && this.isInitialized) {
                this.handleFileCreate(file);
            }
        });
        this.eventRefs.push(createRef);

        // File modified
        const modifyRef = this.app.vault.on('modify', (file) => {
            if (file instanceof TFile && this.isRecipeFile(file) && this.isInitialized) {
                debouncedModify(file);
            }
        });
        this.eventRefs.push(modifyRef);

        // File deleted
        const deleteRef = this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && this.recipes.has(file.path)) {
                this.handleFileDelete(file);
            }
        });
        this.eventRefs.push(deleteRef);

        // File renamed/moved
        const renameRef = this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile && this.isInitialized) {
                this.handleFileRename(file, oldPath);
            }
        });
        this.eventRefs.push(renameRef);

        // Metadata cache resolved (handles frontmatter changes more reliably)
        const resolveRef = this.app.metadataCache.on('resolve', (file) => {
            if (file instanceof TFile && this.isRecipeFile(file) && this.isInitialized) {
                // Only update if we already have this recipe indexed
                if (this.recipes.has(file.path)) {
                    setTimeout(() => debouncedModify(file), 50);
                }
            }
        });
        this.eventRefs.push(resolveRef);
    }

    /**
     * Check if a file is in the recipes folder
     */
    private isRecipeFile(file: TFile): boolean {
        return file.path.startsWith(this.settings.recipesFolder) && file.extension === 'md';
    }

    /**
     * Handle file creation
     */
    private async handleFileCreate(file: TFile): Promise<void> {
        const recipe = await this.buildRecipeFromFile(file);
        if (recipe) {
            this.recipes.set(file.path, recipe);
            this.trigger('recipe-added', recipe);
            if (DEBUG) console.log(`${PLUGIN_NAME}: Added: ${recipe.title}`);
        }
    }

    /**
     * Handle file modification
     */
    private async handleFileModify(file: TFile): Promise<void> {
        const existingRecipe = this.recipes.get(file.path);
        const recipe = await this.buildRecipeFromFile(file);

        if (recipe) {
            this.recipes.set(file.path, recipe);
            if (existingRecipe) {
                this.trigger('recipe-updated', recipe);
                if (DEBUG) console.log(`${PLUGIN_NAME}: Updated: ${recipe.title}`);
            } else {
                this.trigger('recipe-added', recipe);
                if (DEBUG) console.log(`${PLUGIN_NAME}: Added: ${recipe.title}`);
            }
        }
    }

    /**
     * Handle file deletion
     */
    private handleFileDelete(file: TFile): void {
        const recipe = this.recipes.get(file.path);
        if (recipe) {
            this.recipes.delete(file.path);
            this.trigger('recipe-deleted', file.path);
            if (DEBUG) console.log(`${PLUGIN_NAME}: Removed: ${recipe.title}`);
        }
    }

    /**
     * Handle file rename/move
     */
    private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
        const wasRecipe = this.recipes.has(oldPath);
        const isNowRecipe = this.isRecipeFile(file);

        // Remove old entry if it existed
        if (wasRecipe) {
            this.recipes.delete(oldPath);
            this.trigger('recipe-deleted', oldPath);
            if (DEBUG) console.log(`${PLUGIN_NAME}: Removed old path: ${oldPath}`);
        }

        // Add new entry if it's now in recipes folder
        if (isNowRecipe) {
            const recipe = await this.buildRecipeFromFile(file);
            if (recipe) {
                this.recipes.set(file.path, recipe);
                this.trigger('recipe-added', recipe);
                if (DEBUG) console.log(`${PLUGIN_NAME}: Added at new path: ${file.path}`);
            }
        }
    }

    /**
     * Get all indexed recipes
     */
    getRecipes(): Recipe[] {
        return Array.from(this.recipes.values());
    }

    /**
     * Get a specific recipe by path
     */
    getRecipe(path: string): Recipe | undefined {
        return this.recipes.get(path);
    }

    /**
     * Get recipe count
     */
    getCount(): number {
        return this.recipes.size;
    }

    /**
     * Search recipes by title or ingredient
     */
    search(query: string): Recipe[] {
        const lowerQuery = query.toLowerCase();
        return this.getRecipes().filter(recipe =>
            recipe.title.toLowerCase().includes(lowerQuery) ||
            recipe.ingredients.some(ing => ing.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Filter recipes by category
     */
    filterByCategory(category: RecipeCategory): Recipe[] {
        return this.getRecipes().filter(recipe => recipe.category === category);
    }

    /**
     * Filter recipes by dietary flag
     */
    filterByDietaryFlag(flag: DietaryFlag): Recipe[] {
        return this.getRecipes().filter(recipe => recipe.dietaryFlags.includes(flag));
    }

    /**
     * Update settings reference (called when settings change)
     */
    updateSettings(settings: MiseSettings): void {
        const oldFolder = this.settings.recipesFolder;
        this.settings = settings;

        // If recipes folder changed, rescan
        if (oldFolder !== settings.recipesFolder) {
            console.log(`${PLUGIN_NAME}: Recipes folder changed, rescanning...`);
            this.recipes.clear();
            this.scanVault();
        }
    }

    /**
     * Clean up event listeners
     */
    destroy(): void {
        for (const ref of this.eventRefs) {
            this.app.vault.offref(ref);
        }
        this.eventRefs = [];
        this.recipes.clear();
    }
}
