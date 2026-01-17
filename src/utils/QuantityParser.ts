/**
 * QuantityParser - Parse ingredient quantities from strings
 * 
 * Handles formats like:
 * - "2 cups flour"
 * - "1/2 tbsp olive oil"  
 * - "1 1/2 cups sugar"
 * - "3-4 cloves garlic"
 * - "pinch of salt"
 * - "salt to taste"
 */

/**
 * Parsed quantity result
 */
export interface ParsedQuantity {
    /** Numeric value (e.g., 1.5 for "1 1/2") */
    value: number;

    /** Upper value if range (e.g., 4 for "3-4") */
    valueMax?: number;

    /** Unit string, normalized lowercase (e.g., "cups", "tbsp"), null for count items */
    unit: string | null;

    /** The ingredient name */
    ingredient: string;

    /** Whether this is a range like "3-4" */
    isRange: boolean;

    /** Whether this can be scaled (false for "pinch", "to taste") */
    scalable: boolean;

    /** Original raw string */
    raw: string;
}

/**
 * Unit aliases - normalize various spellings to canonical form
 */
const UNIT_ALIASES: Record<string, string> = {
    // Teaspoons
    'tsp': 'tsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    't': 'tsp',

    // Tablespoons
    'tbsp': 'tbsp',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tbs': 'tbsp',
    'T': 'tbsp',

    // Cups
    'cup': 'cup',
    'cups': 'cup',
    'c': 'cup',

    // Ounces
    'oz': 'oz',
    'ounce': 'oz',
    'ounces': 'oz',

    // Pounds
    'lb': 'lb',
    'lbs': 'lb',
    'pound': 'lb',
    'pounds': 'lb',

    // Milliliters/Liters
    'ml': 'ml',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'l': 'l',
    'liter': 'l',
    'liters': 'l',

    // Grams/Kilograms
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'kg': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',

    // Other common units
    'clove': 'clove',
    'cloves': 'clove',
    'slice': 'slice',
    'slices': 'slice',
    'piece': 'piece',
    'pieces': 'piece',
    'can': 'can',
    'cans': 'can',
    'bunch': 'bunch',
    'bunches': 'bunch',
    'head': 'head',
    'heads': 'head',
    'stalk': 'stalk',
    'stalks': 'stalk',
    'sprig': 'sprig',
    'sprigs': 'sprig',
    'package': 'package',
    'packages': 'package',
    'pkg': 'package',
};

/**
 * Non-scalable quantity indicators
 */
const NON_SCALABLE_PATTERNS = [
    /\bpinch\b/i,
    /\bto taste\b/i,
    /\bas needed\b/i,
    /\bfor garnish\b/i,
    /\boptional\b/i,
    /\bsome\b/i,
    /\ba few\b/i,
];

/**
 * Common fraction values
 */
const FRACTION_VALUES: Record<string, number> = {
    '1/2': 0.5,
    '1/3': 1 / 3,
    '2/3': 2 / 3,
    '1/4': 0.25,
    '3/4': 0.75,
    '1/8': 0.125,
    '3/8': 0.375,
    '5/8': 0.625,
    '7/8': 0.875,
};

/**
 * Parse a quantity value string to a number
 * Handles: "2", "1/2", "1 1/2", "2.5"
 */
export function parseQuantityValue(str: string): number {
    str = str.trim();

    // Handle decimal
    if (/^\d+\.?\d*$/.test(str)) {
        return parseFloat(str);
    }

    // Handle simple fraction (1/2)
    if (FRACTION_VALUES[str]) {
        return FRACTION_VALUES[str];
    }

    // Handle x/y fraction
    const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
        return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    }

    // Handle mixed number (1 1/2)
    const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
        const whole = parseInt(mixedMatch[1]);
        const numerator = parseInt(mixedMatch[2]);
        const denominator = parseInt(mixedMatch[3]);
        return whole + (numerator / denominator);
    }

    // Handle range (3-4) - return the first value
    const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
        return parseFloat(rangeMatch[1]);
    }

    return NaN;
}

/**
 * Normalize a unit string to canonical form
 */
export function normalizeUnit(unit: string): string {
    const lower = unit.toLowerCase().trim();
    return UNIT_ALIASES[lower] || lower;
}

/**
 * Parse an ingredient line into structured data
 */
export function parseIngredient(line: string): ParsedQuantity {
    const raw = line.trim();

    // Check for non-scalable patterns
    const scalable = !NON_SCALABLE_PATTERNS.some(pattern => pattern.test(raw));

    // Regex to match: [quantity] [unit] [ingredient]
    // quantity: number, fraction, mixed number, or range
    // unit: optional word
    // ingredient: rest of the line

    const patterns = [
        // "1 1/2 cups flour" - mixed number with unit
        /^(\d+\s+\d+\/\d+)\s+(\w+)\s+(.+)$/,

        // "1/2 tbsp oil" - fraction with unit
        /^(\d+\/\d+)\s+(\w+)\s+(.+)$/,

        // "2 cups flour" - whole number with unit
        /^(\d+(?:\.\d+)?)\s+(\w+)\s+(.+)$/,

        // "3-4 cloves garlic" - range with unit
        /^(\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)\s+(\w+)\s+(.+)$/,

        // "2 eggs" - number with ingredient (no unit)
        /^(\d+(?:\.\d+)?)\s+(.+)$/,

        // "1/2 onion" - fraction with ingredient (no unit)
        /^(\d+\/\d+)\s+(.+)$/,

        // "1 1/2 onions" - mixed with ingredient (no unit)
        /^(\d+\s+\d+\/\d+)\s+(.+)$/,
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
            const quantityStr = match[1];
            let unit: string | null = null;
            let ingredient: string;

            if (match.length === 4) {
                // Pattern with unit
                const potentialUnit = match[2].toLowerCase();
                if (UNIT_ALIASES[potentialUnit] || potentialUnit.length <= 4) {
                    unit = normalizeUnit(potentialUnit);
                    ingredient = match[3];
                } else {
                    // Not a known unit, treat as part of ingredient
                    ingredient = match[2] + ' ' + match[3];
                }
            } else {
                // Pattern without unit
                ingredient = match[2];
            }

            // Parse range
            const rangeMatch = quantityStr.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
            const isRange = !!rangeMatch;

            return {
                value: parseQuantityValue(quantityStr),
                valueMax: isRange ? parseFloat(rangeMatch![2]) : undefined,
                unit,
                ingredient: ingredient.trim(),
                isRange,
                scalable,
                raw,
            };
        }
    }

    // No pattern matched - treat entire line as ingredient with no quantity
    return {
        value: 1,
        unit: null,
        ingredient: raw,
        isRange: false,
        scalable: false,  // Can't scale what we can't parse
        raw,
    };
}

/**
 * Scale a parsed quantity by a factor
 */
export function scaleQuantity(parsed: ParsedQuantity, factor: number): ParsedQuantity {
    if (!parsed.scalable) {
        return parsed;
    }

    return {
        ...parsed,
        value: parsed.value * factor,
        valueMax: parsed.valueMax ? parsed.valueMax * factor : undefined,
    };
}

/**
 * Convert a decimal number to a friendly fraction string
 * Examples: 0.5 → "1/2", 1.25 → "1 1/4", 2.333 → "2 1/3"
 */
export function numberToFraction(num: number): string {
    // Handle whole numbers
    if (Number.isInteger(num)) {
        return num.toString();
    }

    const whole = Math.floor(num);
    const decimal = num - whole;

    // Common fractions to check (in order of preference)
    const fractions: [number, string][] = [
        [0.125, '1/8'],
        [0.25, '1/4'],
        [0.333, '1/3'],
        [0.375, '3/8'],
        [0.5, '1/2'],
        [0.625, '5/8'],
        [0.666, '2/3'],
        [0.75, '3/4'],
        [0.875, '7/8'],
    ];

    // Find closest fraction
    let closestFraction = '';
    let closestDiff = 1;

    for (const [value, fraction] of fractions) {
        const diff = Math.abs(decimal - value);
        if (diff < closestDiff && diff < 0.05) {  // Within 5% tolerance
            closestDiff = diff;
            closestFraction = fraction;
        }
    }

    if (closestFraction) {
        return whole > 0 ? `${whole} ${closestFraction}` : closestFraction;
    }

    // Fall back to decimal with 1-2 decimal places
    if (whole > 0) {
        const decimalPart = (num - whole).toFixed(2).replace(/\.?0+$/, '');
        return `${whole}${decimalPart}`;
    }

    return num.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Get the plural form of a unit
 */
function pluralizeUnit(unit: string, value: number): string {
    if (value === 1) return unit;

    // Units that don't change in plural
    const invariant = ['oz', 'lb', 'ml', 'g', 'kg', 'l', 'tsp', 'tbsp'];
    if (invariant.includes(unit)) return unit;

    // Units with irregular plurals
    const irregulars: Record<string, string> = {
        'bunch': 'bunches',
    };
    if (irregulars[unit]) return irregulars[unit];

    // Standard pluralization
    return unit + 's';
}

/**
 * Format a scaled quantity back to a readable ingredient line
 */
export function formatScaledIngredient(scaled: ParsedQuantity): string {
    // Non-scalable items return as-is
    if (!scaled.scalable) {
        return scaled.raw;
    }

    const valueStr = numberToFraction(scaled.value);
    const maxStr = scaled.valueMax ? numberToFraction(scaled.valueMax) : null;

    let quantityStr: string;
    if (scaled.isRange && maxStr) {
        quantityStr = `${valueStr}-${maxStr}`;
    } else {
        quantityStr = valueStr;
    }

    if (scaled.unit) {
        const unitStr = pluralizeUnit(scaled.unit, scaled.value);
        return `${quantityStr} ${unitStr} ${scaled.ingredient}`;
    } else {
        return `${quantityStr} ${scaled.ingredient}`;
    }
}
