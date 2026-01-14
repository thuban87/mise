/**
 * IngredientParser
 * 
 * Pure functions for extracting ingredients from recipe markdown.
 * Handles various header formats, list styles, and sub-sections.
 */

// Header patterns to match ingredient sections
// Matches: "## Ingredients", "## 🥘 Ingredients", "## 🥘Ingredients", "## Ingredient"
// Case-insensitive, allows various emoji placements
const INGREDIENT_HEADER_PATTERNS = [
    /^##\s*🥘\s*ingredients?\s*$/im,
    /^##\s*ingredients?\s*🥘?\s*$/im,
    /^##\s*ingredients?\s*$/im,
];

// Patterns indicating a new section (stops ingredient extraction)
const SECTION_END_PATTERNS = [
    /^##\s+/,           // Any H2 header
    /^#\s+/,            // Any H1 header
    /^---\s*$/,         // Horizontal rule
];

/**
 * Extract ingredients from recipe markdown content
 */
export function parseIngredients(content: string): string[] {
    // Find the ingredients section header
    const headerMatch = findIngredientHeader(content);
    if (!headerMatch) {
        return [];
    }

    // Find content between Ingredients header and next section
    const startIndex = headerMatch.index + headerMatch.match.length;
    const endIndex = findSectionEnd(content, startIndex);

    const ingredientSection = content.slice(startIndex, endIndex);

    // Parse the section into individual ingredients
    return extractIngredientsFromSection(ingredientSection);
}

/**
 * Find the ingredients header in content
 */
function findIngredientHeader(content: string): { index: number; match: string } | null {
    for (const pattern of INGREDIENT_HEADER_PATTERNS) {
        const match = content.match(pattern);
        if (match && match.index !== undefined) {
            return {
                index: match.index,
                match: match[0],
            };
        }
    }
    return null;
}

/**
 * Find where the ingredients section ends
 */
function findSectionEnd(content: string, startIndex: number): number {
    const remaining = content.slice(startIndex);
    const lines = remaining.split('\n');

    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip the first line (might be empty after header)
        if (i > 0) {
            for (const pattern of SECTION_END_PATTERNS) {
                if (pattern.test(line)) {
                    return startIndex + charCount;
                }
            }
        }

        charCount += line.length + 1; // +1 for newline
    }

    return content.length;
}

/**
 * Extract ingredients from a section of text
 */
function extractIngredientsFromSection(section: string): string[] {
    const lines = section.split('\n');
    const ingredients: string[] = [];

    for (const line of lines) {
        const cleaned = cleanIngredientLine(line);

        if (cleaned && !isSubHeader(cleaned)) {
            ingredients.push(cleaned);
        }
    }

    return ingredients;
}

/**
 * Check if a line is a sub-header (like "**Sauce**" or "### For the sauce")
 */
function isSubHeader(line: string): boolean {
    // Bold text as header: **Sauce**
    if (/^\*\*[^*]+\*\*$/.test(line)) return true;

    // Italic text as header: *Sauce*
    if (/^\*[^*]+\*$/.test(line)) return true;

    // H3+ headers
    if (/^###/.test(line)) return true;

    // Underlined headers using markdown
    if (/^_{2,}$/.test(line) || /^={2,}$/.test(line)) return true;

    return false;
}

/**
 * Clean a single ingredient line
 * Removes list markers, checkboxes, and normalizes whitespace
 */
export function cleanIngredientLine(line: string): string {
    let cleaned = line.trim();

    // Skip empty lines
    if (!cleaned) return '';

    // Skip pure whitespace or horizontal rules
    if (/^[-_*]{3,}$/.test(cleaned)) return '';

    // Remove task list checkboxes: - [ ], - [x], * [ ], etc.
    cleaned = cleaned.replace(/^[-*+]\s*\[[x ]\]\s*/i, '');

    // Remove bullet points: -, *, +
    cleaned = cleaned.replace(/^[-*+]\s+/, '');

    // Remove numbered lists: 1., 2), etc.
    cleaned = cleaned.replace(/^\d+[.)]\s*/, '');

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    // Remove inline checkboxes that might appear mid-line
    cleaned = cleaned.replace(/\[[x ]\]/gi, '').trim();

    return cleaned;
}

/**
 * Parse quantity and unit from an ingredient string
 * Returns { quantity, unit, ingredient }
 * 
 * Examples:
 *   "2 cups flour" -> { quantity: "2", unit: "cups", ingredient: "flour" }
 *   "1/2 tsp salt" -> { quantity: "1/2", unit: "tsp", ingredient: "salt" }
 *   "salt to taste" -> { quantity: null, unit: null, ingredient: "salt to taste" }
 */
export interface ParsedIngredient {
    quantity: string | null;
    unit: string | null;
    ingredient: string;
    original: string;
}

const UNITS = [
    // Volume
    'cup', 'cups', 'c',
    'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tb',
    'teaspoon', 'teaspoons', 'tsp', 'ts',
    'fluid ounce', 'fluid ounces', 'fl oz',
    'pint', 'pints', 'pt',
    'quart', 'quarts', 'qt',
    'gallon', 'gallons', 'gal',
    'milliliter', 'milliliters', 'ml',
    'liter', 'liters', 'l',

    // Weight
    'pound', 'pounds', 'lb', 'lbs',
    'ounce', 'ounces', 'oz',
    'gram', 'grams', 'g',
    'kilogram', 'kilograms', 'kg',

    // Count/Other
    'piece', 'pieces', 'pc', 'pcs',
    'slice', 'slices',
    'clove', 'cloves',
    'can', 'cans',
    'package', 'packages', 'pkg',
    'bunch', 'bunches',
    'sprig', 'sprigs',
    'pinch', 'pinches',
    'dash', 'dashes',
    'head', 'heads',
    'small', 'medium', 'large',
];

// Regex for matching quantities (integers, fractions, decimals)
const QUANTITY_PATTERN = /^(\d+(?:\s*[\/⁄]?\s*\d+)?(?:\.\d+)?)/;

export function parseIngredientQuantity(ingredientStr: string): ParsedIngredient {
    const original = ingredientStr;
    let remaining = ingredientStr.trim();

    // Try to extract quantity
    let quantity: string | null = null;
    const qtyMatch = remaining.match(QUANTITY_PATTERN);
    if (qtyMatch) {
        quantity = qtyMatch[1].trim();
        remaining = remaining.slice(qtyMatch[0].length).trim();
    }

    // Try to extract unit
    let unit: string | null = null;
    const lowerRemaining = remaining.toLowerCase();
    for (const u of UNITS) {
        // Match unit at start of remaining string, followed by space or end
        const unitPattern = new RegExp(`^${u}(?:[s.])?(?:\\s|$)`, 'i');
        if (unitPattern.test(lowerRemaining)) {
            unit = u;
            remaining = remaining.slice(u.length).replace(/^[s.]?\s*/, '');
            break;
        }
    }

    return {
        quantity,
        unit,
        ingredient: remaining.trim(),
        original,
    };
}

/**
 * Normalize an ingredient for comparison/deduplication
 * Lowercase, remove plurals, simplify whitespace
 */
export function normalizeIngredient(ingredient: string): string {
    return ingredient
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
