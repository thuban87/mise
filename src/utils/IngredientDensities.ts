/**
 * IngredientDensities - Volume to weight conversion for common ingredients
 * 
 * Densities are expressed as ounces per cup.
 * Used for inventory deduction when recipe and inventory use different units.
 */

/**
 * Default ingredient densities (oz per cup)
 * Based on standard cooking measurements
 */
export const DEFAULT_DENSITIES: Record<string, number> = {
    // Flours
    'flour': 4.25,
    'all-purpose flour': 4.25,
    'bread flour': 4.5,
    'cake flour': 4.0,
    'whole wheat flour': 4.5,
    'almond flour': 3.4,

    // Sugars
    'sugar': 7.0,
    'granulated sugar': 7.0,
    'brown sugar': 7.5,
    'powdered sugar': 4.0,
    'confectioners sugar': 4.0,

    // Grains
    'rice': 7.0,
    'white rice': 7.0,
    'brown rice': 7.5,
    'oats': 3.0,
    'rolled oats': 3.0,
    'quinoa': 6.0,

    // Fats
    'butter': 8.0,
    'oil': 7.7,
    'olive oil': 7.7,
    'vegetable oil': 7.7,
    'coconut oil': 7.5,

    // Dairy
    'milk': 8.6,
    'cream': 8.0,
    'heavy cream': 8.0,
    'sour cream': 8.5,
    'yogurt': 8.6,

    // Liquids
    'water': 8.35,
    'honey': 12.0,
    'maple syrup': 11.0,
    'molasses': 11.5,

    // Nuts
    'peanut butter': 9.0,
    'almond butter': 9.0,
    'nuts': 5.0,
    'almonds': 5.0,
    'walnuts': 4.0,
    'pecans': 4.0,

    // Miscellaneous
    'cocoa powder': 3.0,
    'cornstarch': 4.5,
    'cornmeal': 5.0,
    'salt': 10.0,
    'baking powder': 8.0,
    'baking soda': 8.0,
};

/**
 * Get density for an ingredient, checking custom overrides first
 * @param ingredient Normalized ingredient name
 * @param customDensities User-defined density overrides
 * @returns Density in oz/cup, or null if unknown
 */
export function getDensity(
    ingredient: string,
    customDensities: Record<string, number> = {}
): number | null {
    const normalized = ingredient.toLowerCase().trim();

    // Check custom densities first
    if (customDensities[normalized] !== undefined) {
        return customDensities[normalized];
    }

    // Check default densities with fuzzy matching
    for (const [key, density] of Object.entries(DEFAULT_DENSITIES)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return density;
        }
    }

    return null;
}

/**
 * Convert volume to weight
 * @param cups Volume in cups
 * @param ingredient Ingredient name
 * @param customDensities User overrides
 * @returns Weight in ounces, or null if density unknown
 */
export function cupsToOunces(
    cups: number,
    ingredient: string,
    customDensities: Record<string, number> = {}
): number | null {
    const density = getDensity(ingredient, customDensities);
    if (density === null) return null;
    return cups * density;
}

/**
 * Convert weight to volume
 * @param ounces Weight in ounces
 * @param ingredient Ingredient name
 * @param customDensities User overrides
 * @returns Volume in cups, or null if density unknown
 */
export function ouncesToCups(
    ounces: number,
    ingredient: string,
    customDensities: Record<string, number> = {}
): number | null {
    const density = getDensity(ingredient, customDensities);
    if (density === null) return null;
    return ounces / density;
}
