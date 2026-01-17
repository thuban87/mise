/**
 * IngredientNormalizer - Normalize imported recipe ingredients
 * 
 * Handles:
 * - Decimal to fraction/smaller unit conversion (0.03 cup → 2 tsp)
 * - Unicode fraction normalization (½ → 1/2)
 * - Unit standardization (tablespoon → tbsp)
 * - Ingredient name aliases (extra virgin olive oil → olive oil)
 * - Preparation text reordering (minced garlic 3 cloves → 3 cloves garlic, minced)
 * - Vague ingredient detection (flags generic "chicken" without cut)
 */

/**
 * Result of normalizing an ingredient
 */
export interface NormalizedIngredient {
    /** The normalized ingredient string */
    formatted: string;
    /** Quantity as a number (for calculations) */
    quantity: number | null;
    /** Normalized unit */
    unit: string | null;
    /** Normalized ingredient name */
    name: string;
    /** Preparation text (minced, diced, etc.) */
    preparation: string | null;
    /** Warnings about vague or problematic ingredients */
    warnings: string[];
    /** Original input */
    original: string;
}

// ============================================================================
// UNICODE FRACTION CONVERSION
// ============================================================================

const UNICODE_FRACTIONS: Record<string, string> = {
    '½': '1/2',
    '⅓': '1/3',
    '¼': '1/4',
    '⅔': '2/3',
    '¾': '3/4',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
    '⅕': '1/5',
    '⅖': '2/5',
    '⅗': '3/5',
    '⅘': '4/5',
    '⅙': '1/6',
    '⅚': '5/6',
};

/**
 * Convert Unicode fractions to ASCII fractions
 */
export function normalizeUnicodeFractions(text: string): string {
    let result = text;
    for (const [unicode, ascii] of Object.entries(UNICODE_FRACTIONS)) {
        result = result.replace(new RegExp(unicode, 'g'), ascii);
    }
    return result;
}

// ============================================================================
// DECIMAL CONVERSION
// ============================================================================

/**
 * Decimal to friendly measurement conversions
 * Key is the unit, value is array of [maxDecimal, replacement] pairs
 */
const DECIMAL_CONVERSIONS: Record<string, [number, string][]> = {
    'cup': [
        [0.05, '2 tsp'],           // 0.03 cup ≈ 2 tsp
        [0.0833, '1 tbsp'],        // 1/12 cup
        [0.125, '2 tbsp'],         // 1/8 cup
        [0.167, '2 1/2 tbsp'],     // ~1/6 cup
        [0.25, '1/4 cup'],
        [0.333, '1/3 cup'],
        [0.5, '1/2 cup'],
        [0.667, '2/3 cup'],
        [0.75, '3/4 cup'],
        [0.875, '7/8 cup'],
    ],
    'tbsp': [
        [0.5, '1 1/2 tsp'],
        [0.333, '1 tsp'],
        [0.667, '2 tsp'],
    ],
};

/**
 * Convert a decimal measurement to a friendly fraction or smaller unit
 * Returns the converted string or null if no conversion needed
 */
export function convertDecimalMeasurement(value: number, unit: string): string | null {
    const lowerUnit = unit.toLowerCase();
    const conversions = DECIMAL_CONVERSIONS[lowerUnit];

    if (!conversions) return null;

    // Check if value is a small decimal that needs conversion
    if (value >= 1) return null; // Don't convert whole numbers or larger

    // Find the closest conversion
    for (const [threshold, replacement] of conversions) {
        if (Math.abs(value - threshold) < 0.03) {
            return replacement;
        }
    }

    // Handle very small values (likely parsing errors like "03 cup")
    if (value < 0.1 && lowerUnit === 'cup') {
        // Convert to tbsp: 1 cup = 16 tbsp
        const tbsp = value * 16;
        if (tbsp < 1) {
            const tsp = tbsp * 3;
            return `${Math.round(tsp)} tsp`;
        }
        return `${Math.round(tbsp)} tbsp`;
    }

    return null;
}

/**
 * Detect and fix leading zero decimals that got parsed wrong
 * "03 cup" should be "0.3 cup" (about 5 tbsp)
 */
export function fixLeadingZeroDecimal(text: string): string {
    // Pattern: "03 cup" or "081 cups" - leading zero followed by digits
    const leadingZeroPattern = /^0(\d+)\s+(cup|cups|tbsp|tsp|oz|lb|lbs)/i;
    const match = text.match(leadingZeroPattern);

    if (match) {
        const digits = match[1];
        const unit = match[2];
        // Convert "03" to "0.3" 
        const decimalValue = parseFloat(`0.${digits}`);
        const rest = text.slice(match[0].length);

        // Convert the decimal to a sensible measurement
        const converted = convertDecimalMeasurement(decimalValue, unit);
        if (converted) {
            return converted + rest;
        }
        return `0.${digits} ${unit}${rest}`;
    }

    return text;
}

// ============================================================================
// UNIT STANDARDIZATION
// ============================================================================

const UNIT_ALIASES: Record<string, string> = {
    // Volume - cups
    'c.': 'cup', 'c': 'cup', 'C': 'cup', 'cups': 'cup',

    // Volume - tablespoons
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'Tbsp': 'tbsp',
    'T': 'tbsp', 'tbsp.': 'tbsp', 'tbs': 'tbsp', 'tbs.': 'tbsp',

    // Volume - teaspoons
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp.': 'tsp', 't': 'tsp',

    // Weight - ounces
    'ounce': 'oz', 'ounces': 'oz', 'oz.': 'oz',

    // Weight - pounds
    'pound': 'lb', 'pounds': 'lb', 'lb.': 'lb', 'lbs.': 'lb', 'lbs': 'lb',

    // Weight - grams
    'gram': 'g', 'grams': 'g', 'g.': 'g',

    // Weight - kilograms
    'kilogram': 'kg', 'kilograms': 'kg', 'kg.': 'kg',

    // Volume - ml/l
    'milliliter': 'ml', 'milliliters': 'ml', 'ml.': 'ml',
    'liter': 'l', 'liters': 'l', 'l.': 'l',

    // Count units
    'clove': 'cloves', 'slice': 'slices', 'piece': 'pieces',
    'can': 'cans', 'package': 'packages', 'pkg': 'packages',
    'bunch': 'bunches', 'head': 'heads', 'stalk': 'stalks',
    'sprig': 'sprigs',
};

/**
 * Normalize a unit to its canonical form
 */
export function normalizeUnit(unit: string): string {
    return UNIT_ALIASES[unit] || UNIT_ALIASES[unit.toLowerCase()] || unit.toLowerCase();
}

// ============================================================================
// INGREDIENT NAME NORMALIZATION
// ============================================================================

/**
 * Groups of equivalent ingredient names
 * First item in each array is the canonical form
 */
const INGREDIENT_GROUPS: string[][] = [
    // Oils
    ['olive oil', 'extra virgin olive oil', 'extra-virgin olive oil', 'evoo', 'olive oil (extra virgin)'],
    ['vegetable oil', 'cooking oil'],

    // Butter
    ['unsalted butter', 'butter, unsalted', 'butter (unsalted)'],
    ['salted butter', 'butter, salted', 'butter (salted)'],

    // Salt
    ['kosher salt', 'coarse salt'],
    ['sea salt', 'fine sea salt'],

    // Pepper
    ['black pepper', 'ground black pepper', 'freshly ground black pepper', 'ground pepper'],

    // Garlic
    ['garlic', 'fresh garlic'],

    // Cheese
    ['parmesan cheese', 'parmesan', 'parmigiano-reggiano', 'parmigiano reggiano'],
    ['mozzarella cheese', 'mozzarella', 'fresh mozzarella'],

    // Onions
    ['yellow onion', 'onion', 'cooking onion'],
    ['red onion', 'purple onion'],
    ['white onion'],
    ['green onion', 'scallion', 'scallions', 'green onions'],

    // Flour
    ['all-purpose flour', 'all purpose flour', 'ap flour', 'plain flour'],

    // Sugar
    ['granulated sugar', 'white sugar', 'sugar'],
    ['brown sugar', 'light brown sugar'],
    ['dark brown sugar'],
    ['powdered sugar', 'confectioners sugar', 'icing sugar'],
];

/**
 * Build a lookup map from aliases to canonical names
 */
const INGREDIENT_ALIAS_MAP: Map<string, string> = new Map();
for (const group of INGREDIENT_GROUPS) {
    const canonical = group[0];
    for (const alias of group) {
        INGREDIENT_ALIAS_MAP.set(alias.toLowerCase(), canonical);
    }
}

/**
 * Normalize an ingredient name to its canonical form
 */
export function normalizeIngredientName(name: string): string {
    const lower = name.toLowerCase().trim();
    return INGREDIENT_ALIAS_MAP.get(lower) || name;
}

// ============================================================================
// PREPARATION TEXT HANDLING
// ============================================================================

const PREP_WORDS = [
    'minced', 'diced', 'chopped', 'sliced', 'crushed', 'grated', 'shredded',
    'peeled', 'cubed', 'halved', 'quartered', 'julienned', 'thinly sliced',
    'finely chopped', 'finely diced', 'finely minced', 'coarsely chopped',
    'melted', 'softened', 'room temperature', 'cold', 'frozen', 'thawed',
    'drained', 'rinsed', 'squeezed', 'zested', 'juiced',
    'divided', 'plus more for serving', 'for garnish', 'optional',
];

/**
 * Extract preparation text from an ingredient string
 * Returns [ingredientWithoutPrep, preparation]
 */
export function extractPreparation(text: string): [string, string | null] {
    // Check for comma-separated preparation
    const commaMatch = text.match(/^(.+?),\s*(.+)$/);
    if (commaMatch) {
        const afterComma = commaMatch[2].toLowerCase();
        // Check if what's after the comma is preparation
        for (const prep of PREP_WORDS) {
            if (afterComma.startsWith(prep.toLowerCase())) {
                return [commaMatch[1].trim(), commaMatch[2].trim()];
            }
        }
    }

    // Check for prep word at start (inverted order like "minced garlic")
    for (const prep of PREP_WORDS) {
        const pattern = new RegExp(`^${prep}\\s+(.+)$`, 'i');
        const match = text.match(pattern);
        if (match) {
            return [match[1].trim(), prep];
        }
    }

    return [text, null];
}

/**
 * Reorder ingredient from "minced garlic 3 cloves" to "3 cloves garlic, minced"
 */
export function reorderPreparation(text: string): string {
    // Pattern: "prep ingredient quantity unit"
    // e.g., "minced garlic 3 cloves"
    for (const prep of PREP_WORDS) {
        const pattern = new RegExp(`^${prep}\\s+(.+?)\\s+(\\d+(?:\\.\\d+)?(?:\\s*[-–]\\s*\\d+)?(?:\\s+\\d+\\/\\d+)?)\\s+(\\w+)(.*)$`, 'i');
        const match = text.match(pattern);
        if (match) {
            const [, ingredient, qty, unit, rest] = match;
            return `${qty} ${unit} ${ingredient}, ${prep}${rest}`;
        }
    }

    // Pattern: "prep quantity unit ingredient" 
    // e.g., "melted 2 tbsp butter"
    for (const prep of PREP_WORDS) {
        const pattern = new RegExp(`^${prep}\\s+(\\d+(?:\\.\\d+)?(?:\\s*[-–]\\s*\\d+)?(?:\\s+\\d+\\/\\d+)?)\\s+(\\w+)\\s+(.+)$`, 'i');
        const match = text.match(pattern);
        if (match) {
            const [, qty, unit, ingredient] = match;
            return `${qty} ${unit} ${ingredient}, ${prep}`;
        }
    }

    return text;
}

// ============================================================================
// VAGUE INGREDIENT DETECTION
// ============================================================================

interface VaguePattern {
    pattern: RegExp;
    warning: string;
}

const VAGUE_PATTERNS: VaguePattern[] = [
    { pattern: /^chicken$/i, warning: 'Specify cut (breasts, thighs, drumsticks, etc.)' },
    { pattern: /^butter$/i, warning: 'Consider specifying salted or unsalted' },
    { pattern: /^oil$/i, warning: 'Specify type (olive, vegetable, canola, etc.)' },
    { pattern: /^salt$/i, warning: 'Consider specifying type (kosher, sea, table)' },
    { pattern: /^onion$/i, warning: 'Consider specifying type (yellow, white, red)' },
    { pattern: /^pepper$/i, warning: 'Specify type (black pepper, bell pepper, etc.)' },
    { pattern: /^flour$/i, warning: 'Consider specifying type (all-purpose, bread, etc.)' },
    { pattern: /^sugar$/i, warning: 'Consider specifying type (granulated, brown, etc.)' },
    { pattern: /^cheese$/i, warning: 'Specify type of cheese' },
    { pattern: /^wine$/i, warning: 'Specify type (red, white, dry, etc.)' },
    { pattern: /^broth$/i, warning: 'Specify type (chicken, beef, vegetable)' },
    { pattern: /^stock$/i, warning: 'Specify type (chicken, beef, vegetable)' },
];

/**
 * Check for vague ingredients and return warnings
 */
export function detectVagueIngredient(ingredientName: string): string[] {
    const warnings: string[] = [];
    const name = ingredientName.toLowerCase().trim();

    for (const { pattern, warning } of VAGUE_PATTERNS) {
        if (pattern.test(name)) {
            warnings.push(warning);
        }
    }

    return warnings;
}

// ============================================================================
// MAIN NORMALIZATION FUNCTION
// ============================================================================

/**
 * Parse quantity from beginning of string
 * Returns [quantity, remaining string]
 */
function parseQuantity(text: string): [number | null, string] {
    const trimmed = text.trim();

    // Mixed number: "1 1/2"
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.*)$/);
    if (mixedMatch) {
        const whole = parseInt(mixedMatch[1]);
        const num = parseInt(mixedMatch[2]);
        const denom = parseInt(mixedMatch[3]);
        return [whole + num / denom, mixedMatch[4]];
    }

    // Fraction: "1/2"
    const fractionMatch = trimmed.match(/^(\d+)\/(\d+)\s+(.*)$/);
    if (fractionMatch) {
        const num = parseInt(fractionMatch[1]);
        const denom = parseInt(fractionMatch[2]);
        return [num / denom, fractionMatch[3]];
    }

    // Decimal or whole number: "0.5" or "2"
    const numberMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
    if (numberMatch) {
        return [parseFloat(numberMatch[1]), numberMatch[2]];
    }

    return [null, trimmed];
}

/**
 * Parse unit from beginning of string
 * Returns [unit, remaining string]
 */
function parseUnit(text: string): [string | null, string] {
    const trimmed = text.trim();
    const allUnits = Object.keys(UNIT_ALIASES).concat(['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'cloves', 'slices', 'pieces', 'cans', 'packages', 'bunches', 'heads', 'stalks', 'sprigs']);

    // Sort by length descending to match longest first
    const sortedUnits = [...new Set(allUnits)].sort((a, b) => b.length - a.length);

    for (const unit of sortedUnits) {
        const pattern = new RegExp(`^${unit}(?:\\s+|$)`, 'i');
        if (pattern.test(trimmed)) {
            return [normalizeUnit(unit), trimmed.slice(unit.length).trim()];
        }
    }

    return [null, trimmed];
}

/**
 * Main normalization function
 */
export function normalizeIngredient(raw: string): NormalizedIngredient {
    const original = raw;
    let text = raw.trim();
    const warnings: string[] = [];

    // Step 1: Normalize unicode fractions
    text = normalizeUnicodeFractions(text);

    // Step 2: Fix leading zero decimals
    text = fixLeadingZeroDecimal(text);

    // Step 3: Reorder preparation text if inverted
    text = reorderPreparation(text);

    // Step 4: Parse quantity
    let [quantity, remaining] = parseQuantity(text);

    // Step 5: Parse unit
    let [unit, afterUnit] = parseUnit(remaining);

    // Step 6: Handle decimal conversion
    if (quantity !== null && unit && quantity < 1) {
        const converted = convertDecimalMeasurement(quantity, unit);
        if (converted) {
            // Re-parse the converted string
            [quantity, remaining] = parseQuantity(converted);
            [unit, afterUnit] = parseUnit(remaining);
        }
    }

    // Step 7: Extract preparation
    const [nameWithoutPrep, preparation] = extractPreparation(afterUnit);

    // Step 8: Normalize ingredient name
    const normalizedName = normalizeIngredientName(nameWithoutPrep);

    // Step 9: Detect vague ingredients
    const vagueWarnings = detectVagueIngredient(normalizedName);
    warnings.push(...vagueWarnings);

    // Step 10: Format the final string
    let formatted = '';
    if (quantity !== null) {
        // Convert to friendly fraction if needed
        formatted = formatQuantity(quantity);
        if (unit) {
            formatted += ` ${unit}`;
        }
        formatted += ` ${normalizedName}`;
    } else {
        formatted = normalizedName;
    }

    if (preparation) {
        formatted += `, ${preparation}`;
    }

    // Log warnings for debugging
    if (warnings.length > 0) {
        console.log(`IngredientNormalizer: "${original}" → warnings: ${warnings.join('; ')}`);
    }

    return {
        formatted,
        quantity,
        unit,
        name: normalizedName,
        preparation,
        warnings,
        original,
    };
}

/**
 * Format a quantity as a friendly string (fractions when appropriate)
 */
function formatQuantity(num: number): string {
    if (Number.isInteger(num)) {
        return num.toString();
    }

    const whole = Math.floor(num);
    const decimal = num - whole;

    // Common fractions
    const fractions: [number, string][] = [
        [0.125, '1/8'],
        [0.25, '1/4'],
        [0.333, '1/3'],
        [0.375, '3/8'],
        [0.5, '1/2'],
        [0.625, '5/8'],
        [0.667, '2/3'],
        [0.75, '3/4'],
        [0.875, '7/8'],
    ];

    for (const [value, fraction] of fractions) {
        if (Math.abs(decimal - value) < 0.03) {
            return whole > 0 ? `${whole} ${fraction}` : fraction;
        }
    }

    // Fall back to decimal
    return num.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Normalize an array of ingredients
 */
export function normalizeIngredients(ingredients: string[]): string[] {
    return ingredients.map(i => normalizeIngredient(i).formatted);
}
