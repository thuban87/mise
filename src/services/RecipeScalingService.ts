/**
 * RecipeScalingService - Handle recipe scaling operations
 * 
 * Creates scaled copies of recipes with adjusted ingredient quantities.
 */

import { App, TFile } from 'obsidian';
import { Recipe, MiseSettings } from '../types';
import { RecipeIndexer } from './RecipeIndexer';
import { parseIngredient, scaleQuantity, formatScaledIngredient } from '../utils/QuantityParser';

export class RecipeScalingService {
    private app: App;
    private settings: MiseSettings;
    private indexer: RecipeIndexer;

    constructor(app: App, settings: MiseSettings, indexer: RecipeIndexer) {
        this.app = app;
        this.settings = settings;
        this.indexer = indexer;
    }

    /**
     * Parse servings string to a number
     * Handles: "4", "8 pancakes", "6-8 servings"
     */
    parseServings(servingsStr: string | undefined): number | null {
        if (!servingsStr) return null;

        // Extract first number from string
        const match = servingsStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Calculate scale factor from current and target servings
     */
    calculateScaleFactor(currentServings: number, targetServings: number): number {
        return targetServings / currentServings;
    }

    /**
     * Scale all ingredients by a factor
     */
    scaleIngredients(ingredients: string[], factor: number): string[] {
        return ingredients.map(ingredient => {
            const parsed = parseIngredient(ingredient);
            const scaled = scaleQuantity(parsed, factor);
            return formatScaledIngredient(scaled);
        });
    }

    /**
     * Generate a new filename for the scaled recipe
     */
    generateScaledFilename(originalPath: string, targetServings: number): string {
        const file = this.app.vault.getAbstractFileByPath(originalPath);
        if (!file || !(file instanceof TFile)) {
            throw new Error(`File not found: ${originalPath}`);
        }

        const baseName = file.basename;
        const parentPath = file.parent?.path || '';

        // Generate new name: "Recipe Name (Scaled to X).md"
        const newName = `${baseName} (Scaled to ${targetServings})`;
        return parentPath ? `${parentPath}/${newName}.md` : `${newName}.md`;
    }

    /**
     * Create a scaled copy of a recipe file
     * Returns the path to the new file
     */
    async createScaledCopy(
        originalPath: string,
        targetServings: number
    ): Promise<string> {
        const file = this.app.vault.getAbstractFileByPath(originalPath);
        if (!file || !(file instanceof TFile)) {
            throw new Error(`File not found: ${originalPath}`);
        }

        // Get recipe data from indexer
        const recipe = this.indexer.getRecipe(originalPath);
        if (!recipe) {
            throw new Error(`Recipe not indexed: ${originalPath}`);
        }

        // Parse current servings
        const currentServings = this.parseServings(recipe.servings);
        if (!currentServings) {
            throw new Error(`Cannot parse servings: ${recipe.servings}`);
        }

        // Calculate scale factor
        const factor = this.calculateScaleFactor(currentServings, targetServings);

        // Scale ingredients
        const scaledIngredients = this.scaleIngredients(recipe.ingredients, factor);

        // Read original file content
        const originalContent = await this.app.vault.read(file);

        // Generate new content with scaled ingredients
        const newContent = this.replaceIngredients(
            originalContent,
            recipe.ingredients,
            scaledIngredients,
            recipe.servings,
            targetServings.toString()
        );

        // Generate new filename
        const newPath = this.generateScaledFilename(originalPath, targetServings);

        // Check if file already exists
        const existingFile = this.app.vault.getAbstractFileByPath(newPath);
        if (existingFile) {
            // Overwrite existing scaled version
            await this.app.vault.modify(existingFile as TFile, newContent);
        } else {
            // Create new file
            await this.app.vault.create(newPath, newContent);
        }

        console.log(`RecipeScalingService: Created scaled recipe at ${newPath}`);
        return newPath;
    }

    /**
     * Replace ingredients in the file content
     */
    private replaceIngredients(
        content: string,
        originalIngredients: string[],
        scaledIngredients: string[],
        originalServings: string,
        newServings: string
    ): string {
        let result = content;

        // Update servings in frontmatter
        result = result.replace(
            /^(servings:\s*).+$/m,
            `$1${newServings}`
        );

        // Replace each ingredient
        // The ingredients from the indexer have the checkbox stripped
        // File format: "- [ ] 1 cup flour" or "- [x] 1 cup flour"
        // Indexed format: "1 cup flour"
        for (let i = 0; i < originalIngredients.length; i++) {
            const original = originalIngredients[i];
            const scaled = scaledIngredients[i];

            if (original !== scaled) {
                // Escape special regex characters in the original ingredient
                const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Match various list formats:
                // - [ ] ingredient
                // - [x] ingredient  
                // * [ ] ingredient
                // + [ ] ingredient
                // - ingredient (plain list)
                // * ingredient (plain list)
                const regex = new RegExp(
                    `^(\\s*[-*+]\\s*(?:\\[[x ]\\]\\s*)?)${escaped}(\\s*)$`,
                    'mi'
                );

                result = result.replace(regex, `$1${scaled}$2`);
            }
        }

        return result;
    }

    /**
     * Get a preview of scaled ingredients without creating a file
     * (for modal display)
     */
    getScaledPreview(
        recipe: Recipe,
        targetServings: number
    ): { ingredients: string[]; factor: number } | null {
        const currentServings = this.parseServings(recipe.servings);
        if (!currentServings) {
            return null;
        }

        const factor = this.calculateScaleFactor(currentServings, targetServings);
        const ingredients = this.scaleIngredients(recipe.ingredients, factor);

        return { ingredients, factor };
    }
}
