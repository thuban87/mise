/**
 * ShoppingListService
 * 
 * Aggregates ingredients from planned meals and generates shopping lists.
 * Groups items by aisle with keyword-based inference.
 */

import { App } from 'obsidian';
import { ShoppingList, ShoppingMode, MiseSettings, Aisle, ShoppingItem, PlannedMeal, Recipe, StoreProfile } from '../types';
import { RecipeIndexer } from './RecipeIndexer';
import { MealPlanService } from './MealPlanService';
import { GeminiService } from './GeminiService';
import { ClaudeService } from './ClaudeService';
import { parseIngredientQuantity, normalizeIngredient, ParsedIngredient } from '../parsers/IngredientParser';
import { parseIngredient, ParsedQuantity } from '../utils/QuantityParser';
import { combineQuantities, CombinedQuantity, getUnitFamily } from '../utils/UnitConverter';

// Aisle inference rules - keywords that suggest an aisle
// Order matters! More specific matches should come first
const AISLE_RULES: { aisle: string; keywords: string[]; emoji: string }[] = [
    {
        // Spices & Seasonings - check BEFORE produce to catch "cayenne pepper", "garlic powder" etc.
        aisle: 'Pantry',
        emoji: '🥫',
        keywords: [
            // Dried/powdered versions (must come before produce catches "garlic", "onion", etc.)
            'garlic powder', 'onion powder', 'ginger powder', 'ground ginger',
            'dried onion', 'dried onions', 'dried garlic', 'dried herbs',
            'tomato paste', 'tomato sauce', 'crushed tomatoes',
            // Spices
            'cayenne', 'paprika', 'cumin', 'oregano', 'thyme', 'cinnamon', 'nutmeg',
            'chili powder', 'curry', 'turmeric', 'coriander', 'allspice', 'cloves',
            'bay leaf', 'bay leaves', 'red pepper flakes', 'crushed red pepper',
            'black pepper', 'white pepper', 'ground pepper', 'seasoning', 'taco seasoning',
            'cajun', 'creole', 'italian seasoning',
            // Pantry staples
            'pasta', 'penne', 'spaghetti', 'linguine', 'fettuccine', 'macaroni',
            'rice', 'white rice', 'brown rice', 'basmati',
            'flour', 'all-purpose flour', 'all purpose flour',
            'sugar', 'brown sugar', 'powdered sugar',
            'oil', 'olive oil', 'vegetable oil', 'canola oil', 'sesame oil', 'cooking oil',
            'vinegar', 'rice wine vinegar', 'balsamic', 'apple cider vinegar',
            'sauce', 'soy sauce', 'hot sauce', 'worcestershire', 'fish sauce', 'bbq sauce', 'salsa',
            'beans', 'canned', 'broth', 'stock', 'bouillon', 'chicken broth', 'chicken stock',
            'salt', 'kosher salt', 'sea salt',
            'honey', 'maple syrup', 'molasses', 'agave',
            'peanut butter', 'almond butter',
            'mayonnaise', 'mustard', 'dijon mustard', 'ketchup', 'sriracha', 'cholula',
            'cornstarch', 'baking powder', 'baking soda', 'yeast', 'instant yeast',
            'oats', 'oatmeal', 'cereal', 'crackers', 'chips',
            'nuts', 'almond', 'walnut', 'pecan', 'cashew', 'peanut',
            'coconut', 'coconut milk', 'bread crumbs', 'panko', 'breadcrumbs',
            'taco shell', 'taco shells', 'masa harina', 'masa',
        ],
    },
    {
        aisle: 'Dairy',
        emoji: '🥛',
        keywords: [
            'milk', 'buttermilk', 'butter', 'unsalted butter', 'salted butter',
            'cream', 'sour cream', 'half and half',
            'whipping cream', 'heavy cream', 'cream cheese',
            'yogurt', 'greek yogurt',
            'eggs', 'egg', 'large egg', 'large eggs',
            // Cheeses - comprehensive list
            'cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'ricotta',
            'fontina', 'asiago', 'gouda', 'provolone', 'swiss', 'gruyere',
            'brie', 'camembert', 'blue cheese', 'gorgonzola', 'manchego',
            'monterey jack', 'colby', 'havarti', 'muenster', 'pepper jack',
            'cottage cheese', 'queso', 'mascarpone', 'american cheese',
        ],
    },
    {
        aisle: 'Meat',
        emoji: '🥩',
        keywords: [
            'chicken', 'chicken breast', 'chicken thigh', 'chicken nuggets',
            'beef', 'steak', 'flank steak', 'ribeye', 'sirloin',
            'ground beef', 'ground turkey', 'ground pork', 'ground chicken',
            'ground chuck', 'ground sirloin', 'ground brisket', 'freshly ground',
            'pork', 'pork chop', 'pork loin', 'pork tenderloin',
            'bacon', 'sausage', 'ham', 'prosciutto', 'pancetta',
            'turkey', 'lamb', 'veal', 'duck',
            'fish', 'salmon', 'shrimp', 'prawn', 'tilapia', 'cod', 'tuna',
            'crab', 'lobster', 'scallop', 'mussels', 'clams',
        ],
    },
    {
        aisle: 'Produce',
        emoji: '🥬',
        keywords: [
            // Vegetables (fresh only - dried/powdered caught above)
            'lettuce', 'tomato', 'tomatoes', 'cherry tomato',
            'onion', 'red onion', 'yellow onion', 'white onion', 'green onion', 'scallion', 'shallot',
            'garlic', 'ginger', 'fresh ginger', 'minced ginger',
            'bell pepper', 'red bell pepper', 'green bell pepper', 'jalapeno', 'jalapeño', 'serrano',
            'carrot', 'celery', 'broccoli', 'cauliflower',
            'spinach', 'kale', 'arugula', 'cabbage', 'bok choy',
            'cucumber', 'zucchini', 'squash', 'eggplant',
            'potato', 'potatoes', 'baby potato', 'red potato', 'sweet potato', 'yam',
            'mushroom', 'portobello',
            'asparagus', 'green beans', 'snap peas', 'snow peas',
            'corn', 'artichoke',
            // Fresh herbs
            'cilantro', 'parsley', 'italian parsley', 'basil', 'mint', 'dill', 'chives', 'rosemary', 'sage',
            // Fruits
            'apple', 'lemon', 'lime', 'orange', 'grapefruit',
            'avocado', 'banana', 'berry', 'berries', 'strawberry', 'blueberry', 'raspberry',
            'grape', 'melon', 'watermelon', 'cantaloupe', 'honeydew',
            'peach', 'pear', 'plum', 'mango', 'pineapple', 'kiwi',
        ],
    },
    {
        aisle: 'Bakery',
        emoji: '🍞',
        keywords: [
            'bread', 'loaf', 'buns', 'bun', 'hamburger bun', 'hot dog bun',
            'potato roll', 'potato rolls',
            'tortilla', 'tortillas', 'wrap', 'pita',
            'roll', 'rolls', 'dinner roll',
            'bagel', 'croissant', 'naan', 'baguette', 'ciabatta', 'focaccia',
            'english muffin', 'croutons',
        ],
    },
    {
        aisle: 'Frozen',
        emoji: '🧊',
        keywords: [
            'frozen', 'ice cream', 'popsicle', 'frozen vegetable', 'frozen fruit',
            'frozen pizza', 'frozen dinner', 'frozen meal',
        ],
    },
];

interface AggregatedIngredient {
    normalized: string;
    /** Combined display text (e.g., "1 tbsp 2 tsp olive oil") */
    displayText: string;
    /** original first ingredient string for backwards compat */
    original: string;
    parsed: ParsedIngredient;
    fromRecipes: string[];
    /** Source breakdown for collapsible display */
    sources: { recipe: string; original: string }[];
    /** Whether there's a unit conflict */
    hasConflict: boolean;
    /** Conflict note */
    conflictNote?: string;
}

/**
 * Enhanced shopping item with combined quantity support
 */
interface EnhancedShoppingItem {
    /** Combined display string (e.g., "1 tbsp 2 tsp olive oil") */
    displayText: string;

    /** The ingredient name */
    ingredient: string;

    /** Source breakdown */
    sources: { recipe: string; original: string }[];

    /** Whether there are unit conflicts for this ingredient */
    hasConflict: boolean;

    /** Linked conflict items (if hasConflict) */
    conflictNote?: string;
}

export class ShoppingListService {
    private app: App;
    private settings: MiseSettings;
    private indexer: RecipeIndexer;
    private mealPlanService: MealPlanService | null = null;

    constructor(app: App, settings: MiseSettings, indexer: RecipeIndexer) {
        this.app = app;
        this.settings = settings;
        this.indexer = indexer;
    }

    /**
     * Set the meal plan service (injected after construction to avoid circular deps)
     */
    setMealPlanService(service: MealPlanService): void {
        this.mealPlanService = service;
    }

    /**
     * Generate a shopping list for a week number
     */
    async generateListForWeek(weekNumber: number, month?: string, year?: number, storeId?: string): Promise<ShoppingList> {
        console.log(`ShoppingListService: Generating list for Week ${weekNumber}`);

        const now = new Date();
        const targetMonth = month || this.getMonthName(now.getMonth());
        const targetYear = year || now.getFullYear();

        // Get meals for this week
        const meals = this.getMealsForWeek(weekNumber, targetMonth, targetYear);
        console.log(`ShoppingListService: Found ${meals.length} meals for Week ${weekNumber}`);

        // Collect ingredients from all recipes
        const ingredients = await this.collectIngredients(meals);

        // Aggregate and deduplicate
        const aggregated = this.aggregateIngredients(ingredients);
        console.log(`ShoppingListService: Aggregated ${ingredients.length} ingredients to ${aggregated.length} unique items`);

        // Get store profile
        const storeProfile = storeId ? this.settings.storeProfiles.find(p => p.id === storeId) : undefined;

        // Group by aisle
        const aisles = this.groupByAisle(aggregated, storeProfile);

        return {
            generatedAt: new Date().toISOString(),
            dateRange: {
                start: `${targetMonth} Week ${weekNumber}`,
                end: `${targetMonth} Week ${weekNumber}`,
            },
            mode: 'normal',
            aisles,
        };
    }

    /**
     * Generate a shopping list for an entire month
     */
    async generateListForMonth(month?: string, year?: number, storeId?: string): Promise<ShoppingList> {
        const now = new Date();
        const targetMonth = month || this.getMonthName(now.getMonth());
        const targetYear = year || now.getFullYear();

        console.log(`ShoppingListService: Generating list for ${targetMonth} ${targetYear}`);

        // Get ALL meals for this month (all weeks)
        const meals = this.getMealsForMonth(targetMonth, targetYear);
        console.log(`ShoppingListService: Found ${meals.length} meals for ${targetMonth}`);

        // Collect ingredients from all recipes
        const ingredients = await this.collectIngredients(meals);

        // Aggregate and deduplicate
        const aggregated = this.aggregateIngredients(ingredients);
        console.log(`ShoppingListService: Aggregated ${ingredients.length} ingredients to ${aggregated.length} unique items`);

        // Get store profile
        const storeProfile = storeId ? this.settings.storeProfiles.find(p => p.id === storeId) : undefined;

        // Group by aisle
        const aisles = this.groupByAisle(aggregated, storeProfile);

        return {
            generatedAt: new Date().toISOString(),
            dateRange: {
                start: `${targetMonth} ${targetYear}`,
                end: `${targetMonth} ${targetYear}`,
            },
            mode: 'normal',
            aisles,
        };
    }

    /**
     * Generate a shopping list for a date range (legacy method)
     */
    async generateList(startDate: string, endDate: string, mode: ShoppingMode = 'normal'): Promise<ShoppingList> {
        // For now, just use month-based generation
        console.log('ShoppingListService.generateList: Using month-based generation');
        return this.generateListForMonth();
    }

    /**
     * Get meals for a specific week from the meal plan
     */
    private getMealsForWeek(weekNumber: number, month: string, year: number): PlannedMeal[] {
        if (!this.mealPlanService) {
            console.warn('ShoppingListService: MealPlanService not set');
            return [];
        }

        const allMeals = this.mealPlanService.getAllMeals();
        return allMeals.filter(meal =>
            meal.weekNumber === weekNumber &&
            meal.planMonth === month &&
            meal.planYear === year
        );
    }

    /**
     * Get all meals for an entire month from the meal plan
     */
    private getMealsForMonth(month: string, year: number): PlannedMeal[] {
        if (!this.mealPlanService) {
            console.warn('ShoppingListService: MealPlanService not set');
            return [];
        }

        const allMeals = this.mealPlanService.getAllMeals();
        return allMeals.filter(meal =>
            meal.planMonth === month &&
            meal.planYear === year
        );
    }

    /**
     * Collect ingredients from all recipes in the meal list
     */
    private async collectIngredients(meals: PlannedMeal[]): Promise<{ ingredient: string; recipeName: string }[]> {
        const results: { ingredient: string; recipeName: string }[] = [];
        let foundCount = 0;
        let notFoundCount = 0;

        for (const meal of meals) {
            if (!meal.recipePath) continue;
            const recipePath = meal.recipePath;

            // Get recipe from indexer - try full path first, then search by title
            let recipe = this.indexer.getRecipe(recipePath);

            if (!recipe) {
                // Try to find by title or filename (recipePath might just be filename)
                const searchTitle = recipePath.replace(/\.md$/i, '');
                const allRecipes = this.indexer.getRecipes();
                recipe = allRecipes.find(r =>
                    r.title.toLowerCase() === searchTitle.toLowerCase() ||
                    r.path.toLowerCase().endsWith(`/${recipePath.toLowerCase()}`) ||
                    r.path.toLowerCase() === recipePath.toLowerCase()
                );
            }

            if (!recipe) {
                notFoundCount++;
                continue;
            }

            foundCount++;

            // Add each ingredient with recipe reference
            for (const ingredient of recipe.ingredients) {
                results.push({
                    ingredient,
                    recipeName: recipe.title,
                });
            }
        }

        // Log summary instead of per-recipe
        console.log(`ShoppingListService: Processed ${foundCount} recipes (${notFoundCount} not found), collected ${results.length} ingredients`);

        return results;
    }

    /**
     * Aggregate ingredients, deduplicating and combining quantities using the QuantityParser
     */
    private aggregateIngredients(ingredients: { ingredient: string; recipeName: string }[]): AggregatedIngredient[] {
        // Parse each ingredient using the new QuantityParser
        const parsed: { parsed: ParsedQuantity; recipe: string; original: string }[] = ingredients.map(item => ({
            parsed: parseIngredient(item.ingredient),
            recipe: item.recipeName,
            original: item.ingredient,
        }));

        // Use combineQuantities to intelligently merge
        const combined = combineQuantities(parsed.map(p => ({
            parsed: p.parsed,
            recipe: p.recipe,
        })));

        // Build a reverse lookup for original strings
        const originalByRecipe = new Map<string, Map<string, string>>();
        for (const item of parsed) {
            const key = item.parsed.ingredient.toLowerCase();
            if (!originalByRecipe.has(key)) {
                originalByRecipe.set(key, new Map());
            }
            originalByRecipe.get(key)!.set(item.recipe, item.original);
        }

        // Convert to AggregatedIngredient format
        return combined.map(item => {
            const key = item.ingredient.toLowerCase();
            const origMap = originalByRecipe.get(key);

            // Build sources array
            const sources = item.sources.map(s => ({
                recipe: s.recipe,
                original: s.original,
            }));

            // Build conflict note
            let conflictNote: string | undefined;
            if (item.hasConflict && item.conflictsWith) {
                const otherUnits = item.conflictsWith
                    .map(c => c.formatted)
                    .join(', ');
                conflictNote = `⚠️ Also: ${otherUnits}`;
            }

            return {
                normalized: key,
                displayText: `${item.formatted} ${item.ingredient}`,
                original: sources[0]?.original || item.ingredient,
                parsed: parseIngredientQuantity(sources[0]?.original || item.ingredient),
                fromRecipes: sources.map(s => s.recipe),
                sources,
                hasConflict: item.hasConflict,
                conflictNote,
            };
        });
    }

    /**
     * Aggregate ingredients with quantity combination
     * Uses the QuantityParser and UnitConverter for intelligent merging
     */
    private aggregateWithCombineQuantities(
        ingredients: { ingredient: string; recipeName: string }[]
    ): EnhancedShoppingItem[] {
        // Parse each ingredient
        const parsed: { parsed: ParsedQuantity; recipe: string }[] = ingredients.map(item => ({
            parsed: parseIngredient(item.ingredient),
            recipe: item.recipeName,
        }));

        // Combine quantities using the UnitConverter
        const combined = combineQuantities(parsed);

        // Convert to EnhancedShoppingItem format
        return combined.map(item => {
            // Build display text
            let displayText = `${item.formatted} ${item.ingredient}`;

            // Add conflict note if needed
            let conflictNote: string | undefined;
            if (item.hasConflict && item.conflictsWith) {
                const otherUnits = item.conflictsWith
                    .map(c => c.formatted)
                    .join(', ');
                conflictNote = `⚠️ Also listed as: ${otherUnits}`;
            }

            return {
                displayText,
                ingredient: item.ingredient,
                sources: item.sources,
                hasConflict: item.hasConflict,
                conflictNote,
            };
        });
    }

    /**
     * Group ingredients by inferred aisle
     */
    private groupByAisle(ingredients: AggregatedIngredient[], storeProfile?: StoreProfile): Aisle[] {
        const aisleMap = new Map<string, { sortKey: string; items: ShoppingItem[] }>();

        for (const ing of ingredients) {
            let aisleName = '';
            let sortKey = '';

            // 1. Try Store Profile Mapping
            if (storeProfile) {
                for (const mapping of storeProfile.aisles) {
                    // Check strict match or partial? Standard rules use partial.
                    // Store profiles might be specific. Let's use includes (case-insensitive) to be flexible.
                    if (mapping.keywords.some(k => ing.normalized.includes(k.toLowerCase()))) {
                        // Found mapping
                        // Name: "8 - Spices" or just "Spices"
                        const prefix = mapping.aisleNumber ? `${mapping.aisleNumber} - ` : '';
                        aisleName = `${prefix}${mapping.aisleName}`;

                        // Sort Key: "008" (for "8") or "z_Spices"
                        const numMatch = mapping.aisleNumber.match(/^(\d+)/);
                        if (numMatch) {
                            sortKey = numMatch[1].padStart(3, '0');
                        } else {
                            sortKey = `z_${mapping.aisleName}`;
                        }
                        break;
                    }
                }
            }

            // 2. Fallback to Default Rules
            if (!aisleName) {
                const aisle = this.inferAisle(ing.normalized);
                aisleName = `${aisle.emoji} ${aisle.name}`;

                // Sort key for defaults
                const aisleOrder = ['Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Other'];
                let idx = aisleOrder.indexOf(aisle.name);
                if (idx === -1) idx = 99;
                // Prefix with 'zz' to ensure they come after numbered aisles
                sortKey = `zz_${idx.toString().padStart(2, '0')}`;
            }

            if (!aisleMap.has(aisleName)) {
                aisleMap.set(aisleName, { sortKey, items: [] });
            }

            aisleMap.get(aisleName)!.items.push({
                ingredient: ing.displayText,
                quantity: ing.parsed.quantity || undefined,
                fromRecipes: ing.fromRecipes,
                checked: false,
                sourceBreakdown: ing.sources,
                hasConflict: ing.hasConflict,
                conflictNote: ing.conflictNote,
            });
        }

        const aisles: Aisle[] = [];
        for (const [name, data] of aisleMap) {
            aisles.push({ name, items: data.items });
        }

        // Sort aisles
        aisles.sort((a, b) => {
            const keyA = aisleMap.get(a.name)!.sortKey;
            const keyB = aisleMap.get(b.name)!.sortKey;
            return keyA.localeCompare(keyB);
        });

        return aisles;
    }

    /**
     * Infer which aisle an ingredient belongs to
     */
    private inferAisle(ingredientName: string): { name: string; emoji: string } {
        const lower = ingredientName.toLowerCase();

        for (const rule of AISLE_RULES) {
            for (const keyword of rule.keywords) {
                if (lower.includes(keyword)) {
                    return { name: rule.aisle, emoji: rule.emoji };
                }
            }
        }

        return { name: 'Other', emoji: '📦' };
    }

    /**
     * Get month name from index
     */
    private getMonthName(monthIndex: number): string {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex];
    }

    /**
     * Write shopping list to a markdown file
     */
    async writeListToFile(list: ShoppingList, dateRangeLabel?: string): Promise<string> {
        const { vault } = this.app;

        // Use provided dateRangeLabel or fall back to list.dateRange.start
        const displayLabel = dateRangeLabel || list.dateRange.start;

        // Generate filename based on date range
        const filename = this.generateFilename(displayLabel);
        const folderPath = this.settings.shoppingListFolder;
        const filePath = `${folderPath}/${filename}`;

        // Generate content
        let content = this.formatListAsMarkdown(list, displayLabel);

        // Optionally clean up with AI (Gemini or Claude)
        if (this.settings.enableGeminiCleanup) {
            const provider = this.settings.aiProvider;
            const apiKey = provider === 'claude' ? this.settings.claudeApiKey : this.settings.geminiApiKey;

            if (!apiKey) {
                console.warn(`ShoppingListService: ${provider} API key not configured, skipping AI cleanup`);
            } else {
                console.log(`ShoppingListService: Running ${provider} AI cleanup...`);
                try {
                    // Load inventory for cross-reference if available
                    let inventoryMarkdown: string | undefined;
                    const inventoryPath = `${this.settings.inventoryFolder}/Inventory.md`;
                    const inventoryFile = vault.getAbstractFileByPath(inventoryPath);
                    if (inventoryFile) {
                        try {
                            inventoryMarkdown = await vault.read(inventoryFile as any);
                            console.log('ShoppingListService: Including inventory for AI cross-reference');
                        } catch (e) {
                            console.warn('ShoppingListService: Could not read inventory file');
                        }
                    }

                    // Use selected provider
                    let result: { success: boolean; cleanedList?: string; error?: string; tokensUsed?: number };
                    if (provider === 'claude') {
                        const claude = new ClaudeService(apiKey);
                        result = await claude.cleanupShoppingList(content, inventoryMarkdown);
                    } else {
                        const gemini = new GeminiService(apiKey);
                        result = await gemini.cleanupShoppingList(content, inventoryMarkdown);
                    }

                    if (result.success && result.cleanedList) {
                        console.log(`ShoppingListService: ${provider} cleanup successful (${result.tokensUsed} tokens)`);
                        content = result.cleanedList;
                    } else {
                        console.warn(`ShoppingListService: ${provider} cleanup failed:`, result.error);
                        // Continue with original content
                    }
                } catch (error) {
                    console.error(`ShoppingListService: ${provider} cleanup error:`, error);
                    // Continue with original content
                }
            }
        }

        // Ensure folder exists
        try {
            const folder = vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await vault.createFolder(folderPath);
            }
        } catch (e) {
            // Folder might already exist
        }

        // Create or overwrite file
        const existingFile = vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            await vault.modify(existingFile as any, content);
        } else {
            await vault.create(filePath, content);
        }

        console.log(`ShoppingListService: Created shopping list at ${filePath}`);
        return filePath;
    }

    /**
     * Generate filename for shopping list
     */
    private generateFilename(dateRangeLabel: string): string {
        // e.g., "Grocery List - Jan 6 - Jan 12.md"
        return `Grocery List - ${dateRangeLabel}.md`;
    }

    /**
     * Format shopping list as markdown
     */
    private formatListAsMarkdown(list: ShoppingList, dateRangeLabel: string): string {
        const lines: string[] = [];
        const today = new Date().toISOString().split('T')[0];
        const showLinks = this.settings.showRecipeSourceLinks;

        // YAML frontmatter
        lines.push('---');
        lines.push(`created: ${today}`);
        lines.push('---');
        lines.push('');

        // Title
        lines.push(`# Grocery List - ${dateRangeLabel}`);
        lines.push('');

        // Aisle sections
        for (const aisle of list.aisles) {
            lines.push(`## ${aisle.name}`);

            for (const item of aisle.items) {
                // Main item line
                let line = `- [ ] ${item.ingredient}`;

                // Add conflict warning if present
                if (item.hasConflict && item.conflictNote) {
                    line += ` ${item.conflictNote}`;
                }

                lines.push(line);

                // Add collapsible breakdown if there are multiple sources
                if (item.sourceBreakdown && item.sourceBreakdown.length > 1) {
                    lines.push('  <details>');
                    lines.push(`  <summary>from ${item.sourceBreakdown.length} recipes</summary>`);
                    lines.push('');
                    for (const source of item.sourceBreakdown) {
                        if (showLinks) {
                            lines.push(`  - [[${source.recipe}]]: ${source.original}`);
                        } else {
                            lines.push(`  - ${source.recipe}: ${source.original}`);
                        }
                    }
                    lines.push('  </details>');
                } else if (item.fromRecipes.length > 0 && (!item.sourceBreakdown || item.sourceBreakdown.length <= 1)) {
                    // Single source - use inline format
                    // This handles the legacy case where sourceBreakdown isn't populated
                    if (!item.sourceBreakdown) {
                        if (showLinks) {
                            const links = item.fromRecipes.map(r => `[[${r}]]`).join(', ');
                            // Re-emit the line with source
                            lines[lines.length - 1] = `- [ ] ${item.ingredient} *(from: ${links})*`;
                        } else {
                            lines[lines.length - 1] = `- [ ] ${item.ingredient} *(from: ${item.fromRecipes.join(', ')})*`;
                        }
                    }
                }
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Filter a shopping list to only include specified categories/aisles
     */
    filterByCategories(list: ShoppingList, categories: string[]): ShoppingList {
        const categorySet = new Set(categories.map(c => c.toLowerCase()));

        const filteredAisles = list.aisles.filter(aisle => {
            // Extract base category from aisle name (remove emoji prefix if present)
            const aisleName = aisle.name.replace(/^[^\w]*/, '').trim().toLowerCase();

            // Check if any category matches
            return categories.some(cat => aisleName.includes(cat.toLowerCase()));
        });

        return {
            ...list,
            aisles: filteredAisles,
        };
    }

    /**
     * Check for old shopping lists and prompt for archiving
     */
    async checkAndPromptArchive(): Promise<void> {
        if (this.settings.autoArchiveShoppingLists === 'off') {
            return;
        }

        const { vault } = this.app;
        const folderPath = this.settings.shoppingListFolder;
        const archivePath = this.settings.shoppingListArchiveFolder;

        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder || !(folder as any).children) {
            return;
        }

        const now = new Date();
        const currentMonth = this.getMonthName(now.getMonth());
        const currentYear = now.getFullYear();
        const currentWeek = this.getWeekNumber(now);

        const filesToArchive: string[] = [];

        for (const file of (folder as any).children) {
            if (file.extension !== 'md') continue;
            if (file.name.startsWith('Grocery List -')) {
                // Parse the filename to extract date info
                // e.g., "Grocery List - January Week 2.md"
                const match = file.name.match(/Grocery List - (\w+)(?: (\d{4}))?(?: Week (\d+))?\.md/);
                if (match) {
                    const fileMonth = match[1];
                    const fileYear = match[2] ? parseInt(match[2]) : currentYear;
                    const fileWeek = match[3] ? parseInt(match[3]) : null;

                    // Check if this list is from a past time period
                    const monthIndex = this.getMonthIndex(fileMonth);
                    const currentMonthIndex = now.getMonth();

                    let shouldArchive = false;

                    if (fileYear < currentYear) {
                        shouldArchive = true;
                    } else if (fileYear === currentYear && monthIndex < currentMonthIndex) {
                        shouldArchive = true;
                    } else if (fileYear === currentYear && monthIndex === currentMonthIndex && fileWeek && fileWeek < currentWeek) {
                        shouldArchive = true;
                    }

                    if (shouldArchive) {
                        filesToArchive.push(file.path);
                    }
                }
            }
        }

        if (filesToArchive.length === 0) {
            return;
        }

        if (this.settings.autoArchiveShoppingLists === 'on') {
            await this.archiveFiles(filesToArchive);
        } else if (this.settings.autoArchiveShoppingLists === 'ask') {
            // Show a notice with action button
            const { Notice } = require('obsidian');
            const notice = new Notice(
                `📋 ${filesToArchive.length} old shopping list(s) found. Archive them?`,
                0  // Don't auto-hide
            );

            // Note: Obsidian's Notice doesn't support buttons directly
            // So we just show the message and let user manually archive
            // In a future enhancement, we could use a modal for this
            console.log('ShoppingListService: Old lists found:', filesToArchive);
        }
    }

    /**
     * Move files to archive folder
     */
    private async archiveFiles(filePaths: string[]): Promise<void> {
        const { vault } = this.app;
        const archivePath = this.settings.shoppingListArchiveFolder;

        // Ensure archive folder exists
        try {
            const folder = vault.getAbstractFileByPath(archivePath);
            if (!folder) {
                await vault.createFolder(archivePath);
            }
        } catch (e) {
            // Folder might already exist
        }

        for (const filePath of filePaths) {
            const file = vault.getAbstractFileByPath(filePath);
            if (file) {
                const newPath = `${archivePath}/${file.name}`;
                await vault.rename(file, newPath);
                console.log(`ShoppingListService: Archived ${filePath} -> ${newPath}`);
            }
        }
    }

    /**
     * Get week number for a date (ISO week number)
     */
    private getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    /**
     * Get month index from name
     */
    private getMonthIndex(monthName: string): number {
        const months = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
        return months.indexOf(monthName.toLowerCase());
    }
}
