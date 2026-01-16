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
import { parseIngredientQuantity, normalizeIngredient, ParsedIngredient } from '../parsers/IngredientParser';

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
    original: string;
    parsed: ParsedIngredient;
    fromRecipes: string[];
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
        console.log(`ShoppingListService: Collected ${ingredients.length} ingredients`);

        // Aggregate and deduplicate
        const aggregated = this.aggregateIngredients(ingredients);
        console.log(`ShoppingListService: Aggregated to ${aggregated.length} unique items`);

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
        console.log(`ShoppingListService: Collected ${ingredients.length} ingredients`);

        // Aggregate and deduplicate
        const aggregated = this.aggregateIngredients(ingredients);
        console.log(`ShoppingListService: Aggregated to ${aggregated.length} unique items`);

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
                console.log(`ShoppingListService: Recipe not found for "${meal.recipePath}" (title: ${meal.recipeTitle})`);
                continue;
            }

            console.log(`ShoppingListService: Found recipe "${recipe.title}" with ${recipe.ingredients.length} ingredients`);

            // Add each ingredient with recipe reference
            for (const ingredient of recipe.ingredients) {
                results.push({
                    ingredient,
                    recipeName: recipe.title,
                });
            }
        }

        return results;
    }

    /**
     * Aggregate ingredients, deduplicating similar items
     */
    private aggregateIngredients(ingredients: { ingredient: string; recipeName: string }[]): AggregatedIngredient[] {
        const map = new Map<string, AggregatedIngredient>();

        for (const { ingredient, recipeName } of ingredients) {
            const parsed = parseIngredientQuantity(ingredient);
            const normalized = normalizeIngredient(parsed.ingredient);

            if (map.has(normalized)) {
                const existing = map.get(normalized)!;
                if (!existing.fromRecipes.includes(recipeName)) {
                    existing.fromRecipes.push(recipeName);
                }
            } else {
                map.set(normalized, {
                    normalized,
                    original: ingredient,
                    parsed,
                    fromRecipes: [recipeName],
                });
            }
        }

        return Array.from(map.values());
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
                ingredient: ing.original,
                quantity: ing.parsed.quantity || undefined,
                fromRecipes: ing.fromRecipes,
                checked: false,
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
        const content = this.formatListAsMarkdown(list, displayLabel);

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
                let line = `- [ ] ${item.ingredient}`;

                // Add recipe sources
                if (item.fromRecipes.length > 0) {
                    if (showLinks) {
                        const links = item.fromRecipes.map(r => `[[${r}]]`).join(', ');
                        line += ` (from: ${links})`;
                    } else {
                        line += ` (from: ${item.fromRecipes.join(', ')})`;
                    }
                }

                lines.push(line);
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
