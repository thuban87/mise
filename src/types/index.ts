/**
 * Mise Plugin - Type Definitions
 * 
 * Central location for all TypeScript interfaces and types.
 * Keep this file as the single source of truth for data structures.
 */

// ============================================================================
// Recipe Types
// ============================================================================

/**
 * Represents a single recipe indexed from the vault
 */
export interface Recipe {
    /** Vault-relative path to the recipe file */
    path: string;

    /** Display name (typically the H1 or filename) */
    title: string;

    /** Parent folder name (used for category inference) */
    folder: string;

    /** Recipe category from frontmatter */
    category: RecipeCategory;

    /** Freeform tags from frontmatter */
    tags: string[];

    /** User rating 1-5, null if not rated */
    rating: number | null;

    /** Servings description (e.g., "4" or "8 pancakes") */
    servings: string;

    /** Prep time in minutes, null if not specified */
    prepTime: number | null;

    /** Cook time in minutes, null if not specified */
    cookTime: number | null;

    /** Source URL if imported from web */
    source: string | null;

    /** Image URL or vault path */
    image: string | null;

    /** Dietary restriction/preference flags */
    dietaryFlags: DietaryFlag[];

    /** Parsed ingredients from recipe body */
    ingredients: string[];

    /** File modification timestamp */
    lastModified: number;

    /** Optional nutritional information (for future API integration) */
    nutrition?: NutritionInfo;
}

/**
 * Valid recipe categories
 */
export type RecipeCategory =
    | 'Main'
    | 'Breakfast'
    | 'Appetizer'
    | 'Side'
    | 'Dessert'
    | 'Beverage'
    | 'Snack'
    | 'Uncategorized';

/**
 * Dietary flags for filtering recipes
 */
export type DietaryFlag =
    | 'crohns-safe'
    | 'low-fiber'
    | 'high-fiber'
    | 'high-protein'
    | 'high-carb'
    | 'low-carb'
    | 'dairy-free'
    | 'gluten-free'
    | 'vegetarian'
    | 'vegan'
    | 'keto'
    | 'paleo';

/**
 * Nutritional information (optional, for future use)
 */
export interface NutritionInfo {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
}

// ============================================================================
// Meal Plan Types
// ============================================================================

/**
 * Represents a month's meal plan
 */
export interface MealPlan {
    /** Month identifier (e.g., "January 2026") */
    month: string;

    /** Days in this plan */
    days: MealDay[];
}

/**
 * Represents a single day in the meal plan
 */
export interface MealDay {
    /** Date in ISO format (e.g., "2026-01-15") */
    date: string;

    /** Day name (e.g., "Wednesday") */
    dayName: string;

    /** Breakfast meals */
    breakfast: PlannedMeal[];

    /** Lunch meals */
    lunch: PlannedMeal[];

    /** Dinner meals */
    dinner: PlannedMeal[];
}

/**
 * Represents a meal assigned to a day
 */
export interface PlannedMeal {
    /** Path to the recipe file (null if not a wikilink) */
    recipePath: string | null;

    /** Recipe or meal title for display */
    recipeTitle: string;

    /** Day abbreviation (Mon, Tue, etc.) */
    day: string;

    /** Week number from meal plan (1, 2, 3, etc.) */
    weekNumber: number;

    /** Month name from meal plan header */
    planMonth: string;

    /** Year from meal plan header */
    planYear: number;

    /** Meal type */
    mealType: 'breakfast' | 'lunch' | 'dinner';

    /** Protein info from table */
    protein?: string;

    /** First side dish */
    side1?: string;

    /** Second side dish */
    side2?: string;

    /** Notes for this meal */
    notes?: string;

    /** Optional scaled servings */
    scaledServings?: number;
}

// ============================================================================
// Shopping List Types
// ============================================================================

/**
 * Represents a generated shopping list
 */
export interface ShoppingList {
    /** When the list was generated (ISO timestamp) */
    generatedAt: string;

    /** Date range the list covers */
    dateRange: {
        start: string;
        end: string;
    };

    /** Shopping mode used for grouping */
    mode: ShoppingMode;

    /** Grouped items by aisle */
    aisles: Aisle[];
}

/**
 * Shopping list generation modes
 */
export type ShoppingMode = 'normal' | 'bulk-buy' | 'pantry' | 'quick-trip';

/**
 * Represents a grocery aisle/category
 */
export interface Aisle {
    /** Aisle name (e.g., "Produce", "Dairy") */
    name: string;

    /** Items in this aisle */
    items: ShoppingItem[];
}

/**
 * Individual shopping list item
 */
export interface ShoppingItem {
    /** Raw ingredient string */
    ingredient: string;

    /** Parsed quantity if available */
    quantity?: string;

    /** Which recipes need this ingredient */
    fromRecipes: string[];

    /** Whether the item has been checked off */
    checked: boolean;

    /** Detailed breakdown of sources (original ingredient text per recipe) */
    sourceBreakdown?: { recipe: string; original: string }[];

    /** Whether there's a unit conflict for this ingredient */
    hasConflict?: boolean;

    /** Conflict note to display */
    conflictNote?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Plugin settings interface
 */
export interface MiseSettings {
    /** Path to recipes folder (vault-relative) */
    recipesFolder: string;

    /** Path to meal plans folder (vault-relative) */
    mealPlanFolder: string;

    /** Path to shopping lists folder (vault-relative) */
    shoppingListFolder: string;

    /** Auto-archive behavior: 'on', 'off', or 'ask' */
    autoArchiveShoppingLists: 'on' | 'off' | 'ask';

    /** Custom aisle configuration (default/general) */
    aisles: AisleConfig[];

    /** Store-specific profiles with custom aisle mappings */
    storeProfiles: StoreProfile[];

    /** What to insert when dropping a recipe on a meal plan */
    mealPlanInsertOptions: MealPlanInsertOptions;

    /** Path to archive folder for old shopping lists (vault-relative) */
    shoppingListArchiveFolder: string;

    /** Show recipe source as wikilinks in shopping list */
    showRecipeSourceLinks: boolean;

    /** Folder for newly imported recipes (vault-relative) */
    importInboxFolder: string;

    /** Folder for downloaded recipe images (vault-relative) */
    importImageFolder: string;

    /** Whether to download images locally on import */
    downloadImagesOnImport: boolean;

    /** Gemini API key for AI-powered list cleanup (optional) */
    geminiApiKey: string;

    /** Whether to use Gemini for shopping list cleanup */
    enableGeminiCleanup: boolean;

    // Inventory settings (Phase 16)

    /** Path to inventory files folder (vault-relative) */
    inventoryFolder: string;

    /** User-defined storage locations within categories */
    storageLocations: string[];

    /** Available expiration date types */
    expirationTypes: string[];

    /** Custom ingredient density overrides (ingredient -> oz per cup) */
    customDensities: Record<string, number>;

    /** Days before expiration to show warning (default: 3) */
    expirationWarningDays: number;
}

/**
 * Custom aisle configuration
 */
export interface AisleConfig {
    /** Aisle name */
    name: string;

    /** Keywords that map to this aisle */
    keywords: string[];
}

/**
 * Options for what gets inserted when adding a recipe to meal plan
 */
export interface MealPlanInsertOptions {
    /** Include recipe wikilink (always true) */
    includeLink: boolean;

    /** Include servings info */
    includeServings: boolean;

    /** Include prep + cook time */
    includeTime: boolean;

    /** Include ingredients inline */
    includeIngredientsInline: boolean;

    /** Include ingredients in callout */
    includeIngredientsCallout: boolean;

    /** Include source link */
    includeSource: boolean;
}

// ============================================================================
// Store Profile Types
// ============================================================================

/**
 * A store profile with custom aisle mappings
 */
export interface StoreProfile {
    /** Unique identifier (e.g., "jewel", "marianos") */
    id: string;

    /** Display name (e.g., "Jewel-Osco") */
    name: string;

    /** Whether this is the default store */
    isDefault: boolean;

    /** Custom aisle mappings for this store */
    aisles: StoreAisleMapping[];
}

/**
 * Maps keywords to a specific aisle at a store
 */
export interface StoreAisleMapping {
    /** Aisle name/label (user can include emoji, e.g., "🥫 Spices") */
    aisleName: string;

    /** Aisle number or location (e.g., "8", "Back Wall") */
    aisleNumber: string;

    /** Keywords that map to this aisle (overrides defaults) */
    keywords: string[];
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: MiseSettings = {
    recipesFolder: 'Life/Household/Kitchen/Recipes',
    mealPlanFolder: 'Life/Household/Kitchen/Meal Plans',
    shoppingListFolder: 'Life/Household/Shopping Lists',
    autoArchiveShoppingLists: 'off',
    aisles: [
        { name: 'Produce', keywords: ['lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'apple', 'lemon', 'lime', 'orange', 'banana', 'potato', 'carrot', 'celery', 'broccoli', 'spinach'] },
        { name: 'Dairy', keywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'sour cream', 'eggs'] },
        { name: 'Meat', keywords: ['chicken', 'beef', 'pork', 'steak', 'ground', 'bacon', 'sausage', 'turkey', 'fish', 'salmon', 'shrimp'] },
        { name: 'Bakery', keywords: ['bread', 'buns', 'tortillas', 'rolls', 'bagels'] },
        { name: 'Pantry', keywords: ['pasta', 'rice', 'flour', 'sugar', 'oil', 'vinegar', 'sauce', 'broth', 'stock', 'beans', 'canned'] },
        { name: 'Frozen', keywords: ['frozen', 'ice cream'] },
        { name: 'Beverages', keywords: ['soda', 'juice', 'water', 'coffee', 'tea'] },
    ],
    storeProfiles: [],
    mealPlanInsertOptions: {
        includeLink: true,
        includeServings: false,
        includeTime: false,
        includeIngredientsInline: false,
        includeIngredientsCallout: false,
        includeSource: false,
    },
    shoppingListArchiveFolder: 'Life/Household/Shopping Lists/Archive',
    showRecipeSourceLinks: true,
    importInboxFolder: 'Life/Household/Kitchen/Recipes/Inbox',
    importImageFolder: 'Resources/Imports/Recipe-Images',
    downloadImagesOnImport: false,
    geminiApiKey: '',
    enableGeminiCleanup: false,
    // Inventory defaults
    inventoryFolder: 'Life/Household/Kitchen/Inventory',
    storageLocations: ['Pantry', 'Fridge', 'Freezer'],
    expirationTypes: ['Best By', 'Use By', 'Expires', 'Sell By'],
    customDensities: {},
    expirationWarningDays: 3,
};

// ============================================================================
// Inventory Types
// ============================================================================

/**
 * Inventory storage categories (main domains)
 */
export type InventoryCategory = 'Pantry' | 'Fridge' | 'Freezer';

/**
 * Expiration date types for inventory items
 */
export type ExpiryType = 'Best By' | 'Use By' | 'Expires' | 'Sell By';

/**
 * Reasons for throwing away food
 */
export type WasteReason = 'Spoiled/Expired' | 'Leftover Forgotten' | "Didn't Like" | 'Other';

/**
 * Represents an item in the kitchen inventory
 */
export interface InventoryItem {
    /** Normalized ingredient name */
    name: string;

    /** Current quantity */
    quantity: number;

    /** Unit of measurement (oz, cups, count, etc.) */
    unit: string;

    /** Main storage category */
    category: InventoryCategory;

    /** Specific storage location (user-defined, e.g., "Spice Cabinet") */
    location: string;

    /** Date item was purchased (ISO format) */
    purchaseDate: string;

    /** Date item expires (ISO format, optional) */
    expirationDate?: string;

    /** Type of expiration date */
    expirationType?: ExpiryType;
}

/**
 * Food waste log entry
 */
export interface WasteLogEntry {
    /** Item name */
    name: string;

    /** Quantity wasted */
    quantity: number;

    /** Unit of measurement */
    unit: string;

    /** Reason for waste */
    reason: WasteReason;

    /** Date logged (ISO format) */
    date: string;

    /** Optional notes */
    notes?: string;
}

/**
 * Custom meal log entry (for ad-hoc meals not from cookbook)
 */
export interface CustomMealEntry {
    /** Meal name/description */
    name: string;

    /** Ingredients used (raw format from user input) */
    ingredients: string[];

    /** Date logged (ISO format) */
    date: string;

    /** Meal type */
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the RecipeIndexer service
 */
export type RecipeIndexerEvent =
    | { type: 'recipe-added'; recipe: Recipe }
    | { type: 'recipe-updated'; recipe: Recipe }
    | { type: 'recipe-deleted'; path: string }
    | { type: 'index-ready'; count: number };

