/**
 * ShoppingListService
 * 
 * Aggregates ingredients from planned meals and generates shopping lists.
 * Groups items by aisle with keyword-based inference.
 */

import { App } from 'obsidian';
import { ShoppingList, ShoppingMode, MiseSettings, Aisle, ShoppingItem, PlannedMeal, Recipe } from '../types';
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
    async generateListForWeek(weekNumber: number, month?: string, year?: number): Promise<ShoppingList> {
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

        // Group by aisle
        const aisles = this.groupByAisle(aggregated);

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
    async generateListForMonth(month?: string, year?: number): Promise<ShoppingList> {
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

        // Group by aisle
        const aisles = this.groupByAisle(aggregated);

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

            // Get recipe from indexer - try full path first, then search by title
            let recipe = this.indexer.getRecipe(meal.recipePath);

            if (!recipe) {
                // Try to find by title or filename (recipePath might just be filename)
                const searchTitle = meal.recipePath.replace(/\.md$/i, '');
                const allRecipes = this.indexer.getRecipes();
                recipe = allRecipes.find(r =>
                    r.title.toLowerCase() === searchTitle.toLowerCase() ||
                    r.path.toLowerCase().endsWith(`/${meal.recipePath.toLowerCase()}`) ||
                    r.path.toLowerCase() === meal.recipePath.toLowerCase()
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
    private groupByAisle(ingredients: AggregatedIngredient[]): Aisle[] {
        const aisleMap = new Map<string, { emoji: string; items: ShoppingItem[] }>();

        for (const ing of ingredients) {
            const aisle = this.inferAisle(ing.normalized);

            if (!aisleMap.has(aisle.name)) {
                aisleMap.set(aisle.name, { emoji: aisle.emoji, items: [] });
            }

            aisleMap.get(aisle.name)!.items.push({
                ingredient: ing.original,
                quantity: ing.parsed.quantity || undefined,
                fromRecipes: ing.fromRecipes,
                checked: false,
            });
        }

        // Convert to array, sorted by aisle name
        const aisles: Aisle[] = [];
        for (const [name, data] of aisleMap) {
            aisles.push({
                name: `${data.emoji} ${name}`,
                items: data.items,
            });
        }

        // Sort aisles in a logical order
        const aisleOrder = ['Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Other'];
        aisles.sort((a, b) => {
            const aBase = a.name.replace(/^[^\w]+/, '').trim();
            const bBase = b.name.replace(/^[^\w]+/, '').trim();
            return aisleOrder.indexOf(aBase) - aisleOrder.indexOf(bBase);
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
     * Write shopping list to a file (Phase 13)
     */
    async writeListToFile(list: ShoppingList): Promise<string> {
        // TODO: Phase 13 - Implement file writing
        console.log('ShoppingListService.writeListToFile: Will be implemented in Phase 13');
        return '';
    }
}
