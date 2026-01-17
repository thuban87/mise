/**
 * UnitConverter - Unit families, conversion, and formatting
 * 
 * Handles combining quantities of the same ingredient and formatting
 * results in natural cooking notation.
 */

import { ParsedQuantity } from './QuantityParser';

/**
 * Unit families for grouping compatible units
 */
export type UnitFamily =
    | 'small-volume'   // tsp, tbsp, cups - all combinable
    | 'large-volume'   // quarts, gallons
    | 'weight-imperial'// oz, lb
    | 'weight-metric'  // g, kg
    | 'volume-metric'  // ml, l
    | 'count'          // eggs, cloves
    | 'unknown';

/**
 * Unit definition with conversion info
 */
interface UnitInfo {
    family: UnitFamily;
    baseUnit: string;      // The smallest unit in this family
    toBase: number;        // Multiplier to convert to base unit
    plural?: string;       // Plural form if different
}

/**
 * Unit definitions - conversions within families
 */
const UNITS: Record<string, UnitInfo> = {
    // Small volume (base: tsp) - includes cups now for proper combining
    // 1 tbsp = 3 tsp, 1 cup = 48 tsp = 16 tbsp
    'tsp': { family: 'small-volume', baseUnit: 'tsp', toBase: 1 },
    'tbsp': { family: 'small-volume', baseUnit: 'tsp', toBase: 3 },
    'cup': { family: 'small-volume', baseUnit: 'tsp', toBase: 48 },
    'c': { family: 'small-volume', baseUnit: 'tsp', toBase: 48 },  // abbreviation

    // Large volume (base: quart) - rarely used, keep simple
    'quart': { family: 'large-volume', baseUnit: 'quart', toBase: 1 },
    'gallon': { family: 'large-volume', baseUnit: 'quart', toBase: 4 },

    // Weight imperial (base: oz)
    'oz': { family: 'weight-imperial', baseUnit: 'oz', toBase: 1, plural: 'oz' },
    'lb': { family: 'weight-imperial', baseUnit: 'oz', toBase: 16, plural: 'lbs' },

    // Weight metric (base: g)
    'g': { family: 'weight-metric', baseUnit: 'g', toBase: 1 },
    'kg': { family: 'weight-metric', baseUnit: 'g', toBase: 1000 },

    // Volume metric (base: ml)
    'ml': { family: 'volume-metric', baseUnit: 'ml', toBase: 1 },
    'l': { family: 'volume-metric', baseUnit: 'ml', toBase: 1000 },

    // Count items - no conversion, just add
    'clove': { family: 'count', baseUnit: 'clove', toBase: 1 },
    'slice': { family: 'count', baseUnit: 'slice', toBase: 1 },
    'piece': { family: 'count', baseUnit: 'piece', toBase: 1 },
    'can': { family: 'count', baseUnit: 'can', toBase: 1 },
    'bunch': { family: 'count', baseUnit: 'bunch', toBase: 1 },
    'head': { family: 'count', baseUnit: 'head', toBase: 1 },
    'stalk': { family: 'count', baseUnit: 'stalk', toBase: 1 },
    'sprig': { family: 'count', baseUnit: 'sprig', toBase: 1 },
    'package': { family: 'count', baseUnit: 'package', toBase: 1 },
};

/**
 * Combined quantity result
 */
export interface CombinedQuantity {
    /** Total value in the display unit */
    value: number;

    /** Display unit */
    unit: string | null;

    /** Formatted display string */
    formatted: string;

    /** Ingredient name (normalized) */
    ingredient: string;

    /** Original sources */
    sources: { recipe: string; original: string }[];

    /** Unit family of this quantity */
    family: UnitFamily;

    /** Whether there are conflicting unit families for this ingredient */
    hasConflict: boolean;

    /** Conflicting items (different unit family, same ingredient) */
    conflictsWith?: CombinedQuantity[];
}

/**
 * Get unit info for a unit string
 */
export function getUnitInfo(unit: string | null): UnitInfo {
    if (!unit) {
        return { family: 'count', baseUnit: '', toBase: 1 };
    }
    return UNITS[unit] || { family: 'unknown', baseUnit: unit, toBase: 1 };
}

/**
 * Get the unit family for a unit
 */
export function getUnitFamily(unit: string | null): UnitFamily {
    return getUnitInfo(unit).family;
}

/**
 * Convert a value to the base unit of its family
 */
export function toBaseUnit(value: number, unit: string | null): { value: number; baseUnit: string } {
    const info = getUnitInfo(unit);
    return {
        value: value * info.toBase,
        baseUnit: info.baseUnit,
    };
}

/**
 * Convert a base unit value back to a display format
 * Uses mixed notation where appropriate (e.g., "1 tbsp 2 tsp")
 */
export function fromBaseUnit(value: number, family: UnitFamily): { value: number; unit: string; formatted: string } {
    switch (family) {
        case 'small-volume':
            return formatSmallVolume(value);
        case 'weight-imperial':
            return formatWeightImperial(value);
        default:
            // For other families, just return as-is with fraction formatting
            return {
                value,
                unit: '',
                formatted: formatFraction(value),
            };
    }
}

/**
 * Format small volume (tsp base) as mixed notation
 * Now handles cups too: 1 cup = 48 tsp = 16 tbsp
 * 
 * Examples:
 *   5 tsp → "1 tbsp 2 tsp"
 *   48 tsp → "1 cup"
 *   60 tsp → "1 1/4 cups"
 */
function formatSmallVolume(tspValue: number): { value: number; unit: string; formatted: string } {
    // For larger amounts, show in cups
    if (tspValue >= 24) {  // >= 1/2 cup, show in cups
        const cups = tspValue / 48;
        const unit = cups === 1 ? 'cup' : 'cups';
        return {
            value: cups,
            unit: 'cup',
            formatted: `${formatFraction(cups)} ${unit}`,
        };
    }

    const tbsp = Math.floor(tspValue / 3);
    const tsp = tspValue % 3;

    if (tbsp === 0) {
        return {
            value: tsp,
            unit: 'tsp',
            formatted: `${formatFraction(tsp)} tsp`,
        };
    }

    if (tsp === 0 || tsp < 0.1) {
        return {
            value: tbsp,
            unit: 'tbsp',
            formatted: `${formatFraction(tbsp)} tbsp`,
        };
    }

    // Mixed: "1 tbsp 2 tsp"
    return {
        value: tspValue,
        unit: 'tsp',
        formatted: `${formatFraction(tbsp)} tbsp ${formatFraction(tsp)} tsp`,
    };
}

/**
 * Format weight imperial (oz base) with mixed notation for lbs
 * e.g., 20 oz → "1 lb 4 oz"
 */
function formatWeightImperial(ozValue: number): { value: number; unit: string; formatted: string } {
    const lbs = Math.floor(ozValue / 16);
    const oz = ozValue % 16;

    if (lbs === 0) {
        return {
            value: oz,
            unit: 'oz',
            formatted: `${formatFraction(oz)} oz`,
        };
    }

    if (oz === 0 || oz < 0.1) {
        const unit = lbs === 1 ? 'lb' : 'lbs';
        return {
            value: lbs,
            unit: 'lb',
            formatted: `${formatFraction(lbs)} ${unit}`,
        };
    }

    // Mixed: "1 lb 4 oz"
    const lbUnit = lbs === 1 ? 'lb' : 'lbs';
    return {
        value: ozValue,
        unit: 'oz',
        formatted: `${formatFraction(lbs)} ${lbUnit} ${formatFraction(oz)} oz`,
    };
}

/**
 * Format a number as a fraction string
 * Rounds to nearest common fraction (1/2, 1/3, 1/4, 2/3, 3/4)
 */
export function formatFraction(value: number): string {
    // Handle whole numbers
    if (Number.isInteger(value)) {
        return value.toString();
    }

    const whole = Math.floor(value);
    const decimal = value - whole;

    // Find closest common fraction
    const fractions: [number, string][] = [
        [0, ''],
        [0.25, '1/4'],
        [1 / 3, '1/3'],
        [0.5, '1/2'],
        [2 / 3, '2/3'],
        [0.75, '3/4'],
        [1, ''],
    ];

    let closest = fractions[0];
    let minDiff = Math.abs(decimal - fractions[0][0]);

    for (const [fracValue, fracStr] of fractions) {
        const diff = Math.abs(decimal - fracValue);
        if (diff < minDiff) {
            minDiff = diff;
            closest = [fracValue, fracStr];
        }
    }

    const [closestValue, closestStr] = closest;

    if (closestValue === 0) {
        return whole.toString();
    }

    if (closestValue === 1) {
        return (whole + 1).toString();
    }

    if (whole === 0) {
        return closestStr;
    }

    return `${whole} ${closestStr}`;
}

/**
 * Normalize an ingredient name for grouping
 * Lowercase, remove extra whitespace, basic stemming, and combine common variations
 */
export function normalizeIngredientName(name: string): string {
    let normalized = name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        // Normalize hyphens - "all-purpose" → "all purpose"
        .replace(/-/g, ' ')
        // Remove common suffixes/modifiers
        .replace(/,.*$/, '')  // Remove "flour, all-purpose" → "flour"
        .replace(/\s*\([^)]*\)\s*/g, ' ')  // Remove parentheticals
        .replace(/\s+sifted$/i, '')  // Remove "sifted" at end
        .replace(/\bextra[\s]?virgin\b/gi, '')  // "extra virgin olive oil" → "olive oil"
        .replace(/\bextra[\s]?light\b/gi, '')
        .replace(/\bvirgin\b/gi, '')
        .replace(/\blight\b/gi, '')
        .replace(/\bfresh(?:ly)?\b/gi, '')
        .replace(/\bdried\b/gi, '')
        .replace(/\bground\b/gi, '')
        .replace(/\bpowdered?\b/gi, '')
        .replace(/\bfor\s+(the\s+)?pan\b/gi, '')  // "oil for the pan" → "oil"
        .replace(/\bto\s+taste\b/gi, '')
        .replace(/\bfor\s+serving\b/gi, '')
        .replace(/\bfor\s+garnish\b/gi, '')
        .replace(/\bdivided\b/gi, '')
        .replace(/\bgrated\b/gi, '')
        .replace(/\bshredded\b/gi, '')
        .replace(/\bminced\b/gi, '')
        .replace(/\bchopped\b/gi, '')
        .replace(/\bsliced\b/gi, '')
        .replace(/,?\s*melted$/i, '')  // "butter, melted" → "butter"
        .replace(/,?\s*softened$/i, '')
        .replace(/,?\s*room\s+temperature$/i, '')
        // Normalize plurals (simple cases)
        .replace(/\beggs\b/g, 'egg')
        .replace(/\bcloves\b/g, 'clove')
        .replace(/\bonions\b/g, 'onion')
        .replace(/\btomatoes\b/g, 'tomato')
        .replace(/\bpeppers\b/g, 'pepper')
        .replace(/\s+/g, ' ')
        .trim();

    // Apply equivalences for common items
    const EQUIVALENCES: Record<string, string> = {
        // Oils
        'evoo': 'olive oil',
        'cooking oil': 'vegetable oil',
        'oil': 'vegetable oil',
        'olive oil': 'olive oil',  // Ensure this stays as-is after stripping "extra virgin"

        // Salt variations
        'kosher salt & pepper': 'salt',
        'salt & pepper': 'salt',
        'kosher salt & black pepper': 'salt',
        'salt and pepper': 'salt',
        'kosher salt': 'salt',
        'sea salt': 'salt',
        'fine grind sea salt': 'salt',

        // Pepper variations
        'freshly black pepper': 'black pepper',
        'fresh black pepper': 'black pepper',
        'freshly pepper': 'black pepper',
        'pepper': 'black pepper',

        // Paprika - keep smoked separate
        'smoky paprika': 'smoked paprika',

        // Flour
        'all purpose flour': 'flour',
        'all  purpose flour': 'flour', // double space from hyphen removal
        'flour': 'flour',

        // Parmesan
        'parmesan': 'parmesan',
        'parmesan cheese': 'parmesan',

        // Garlic - normalize "garlic, minced" etc
        'garlic': 'garlic',
    };

    return EQUIVALENCES[normalized] || normalized;
}

/**
 * Combine quantities of the same ingredient
 * Groups by ingredient name + unit family
 */
export function combineQuantities(
    items: { parsed: ParsedQuantity; recipe: string }[]
): CombinedQuantity[] {
    // Group by normalized ingredient name
    const byIngredient = new Map<string, { parsed: ParsedQuantity; recipe: string }[]>();

    for (const item of items) {
        const key = normalizeIngredientName(item.parsed.ingredient);
        if (!byIngredient.has(key)) {
            byIngredient.set(key, []);
        }
        byIngredient.get(key)!.push(item);
    }

    const results: CombinedQuantity[] = [];

    // Process each ingredient group
    for (const [ingredientKey, ingredientItems] of byIngredient) {
        // Sub-group by unit family
        const byFamily = new Map<UnitFamily, { parsed: ParsedQuantity; recipe: string }[]>();

        for (const item of ingredientItems) {
            const family = getUnitFamily(item.parsed.unit);
            if (!byFamily.has(family)) {
                byFamily.set(family, []);
            }
            byFamily.get(family)!.push(item);
        }

        // Check for conflicts (multiple families for same ingredient)
        const hasConflict = byFamily.size > 1;
        const familyResults: CombinedQuantity[] = [];

        // Combine within each family
        for (const [family, familyItems] of byFamily) {
            // Sum up values in base units
            let totalBase = 0;
            let baseUnit = '';
            const sources: { recipe: string; original: string }[] = [];

            for (const item of familyItems) {
                const { value: baseValue, baseUnit: bu } = toBaseUnit(item.parsed.value, item.parsed.unit);
                totalBase += baseValue;
                baseUnit = bu;
                sources.push({
                    recipe: item.recipe,
                    original: item.parsed.raw,
                });
            }

            // Format the combined value
            const formatted = fromBaseUnit(totalBase, family);

            // Get a display unit
            let displayUnit = formatted.unit || familyItems[0].parsed.unit;

            familyResults.push({
                value: totalBase,
                unit: displayUnit,
                formatted: formatted.formatted,
                ingredient: ingredientItems[0].parsed.ingredient,
                sources,
                family,
                hasConflict,
            });
        }

        // Link conflicts together
        if (hasConflict) {
            for (const result of familyResults) {
                result.conflictsWith = familyResults.filter(r => r !== result);
            }
        }

        results.push(...familyResults);
    }

    return results;
}

/**
 * Format a quantity with its unit for display
 */
export function formatQuantityWithUnit(parsed: ParsedQuantity): string {
    const qty = parsed.isRange
        ? `${formatFraction(parsed.value)}-${formatFraction(parsed.valueMax!)}`
        : formatFraction(parsed.value);

    if (parsed.unit) {
        const unitDisplay = parsed.value === 1 ? parsed.unit : pluralizeUnit(parsed.unit, parsed.value);
        return `${qty} ${unitDisplay} ${parsed.ingredient}`;
    }

    return `${qty} ${parsed.ingredient}`;
}

/**
 * Pluralize a unit if needed
 */
function pluralizeUnit(unit: string, value: number): string {
    if (value === 1) return unit;

    const info = UNITS[unit];
    if (info?.plural) return info.plural;

    // Simple pluralization
    if (unit.endsWith('ch') || unit.endsWith('sh') || unit.endsWith('s')) {
        return unit + 'es';
    }
    if (!unit.endsWith('s')) {
        return unit + 's';
    }
    return unit;
}
