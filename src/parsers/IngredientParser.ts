/**
 * IngredientParser (Placeholder)
 * 
 * This module will be implemented in Phase 3.
 * Pure functions for extracting ingredients from recipe markdown.
 */

/**
 * Extract ingredients from recipe markdown content
 */
export function parseIngredients(content: string): string[] {
    // TODO: Phase 3 - Implement ingredient extraction

    // Match the Ingredients header (with or without emoji)
    const headerMatch = content.match(/##\s+(?:🥘\s*)?Ingredients?\s*\n/i);
    if (!headerMatch) {
        return [];
    }

    // Find content between Ingredients header and next header
    const startIndex = headerMatch.index! + headerMatch[0].length;
    const nextHeaderMatch = content.slice(startIndex).match(/\n##\s+/);
    const endIndex = nextHeaderMatch
        ? startIndex + nextHeaderMatch.index!
        : content.length;

    const ingredientSection = content.slice(startIndex, endIndex);

    // Split into lines and clean
    const lines = ingredientSection.split('\n');
    const ingredients: string[] = [];

    for (const line of lines) {
        let cleaned = line.trim();

        // Skip empty lines
        if (!cleaned) continue;

        // Skip sub-headers (like "**Sauce**")
        if (cleaned.startsWith('**') && cleaned.endsWith('**')) continue;

        // Remove list markers
        cleaned = cleaned.replace(/^[-*]\s*\[.\]\s*/, ''); // Task list: - [ ]
        cleaned = cleaned.replace(/^[-*]\s*/, '');          // Bullet: - or *
        cleaned = cleaned.replace(/^\d+\.\s*/, '');         // Numbered: 1.

        cleaned = cleaned.trim();

        if (cleaned) {
            ingredients.push(cleaned);
        }
    }

    return ingredients;
}

/**
 * Clean a single ingredient line
 */
export function cleanIngredientLine(line: string): string {
    let cleaned = line.trim();
    cleaned = cleaned.replace(/^[-*]\s*\[.\]\s*/, '');
    cleaned = cleaned.replace(/^[-*]\s*/, '');
    cleaned = cleaned.replace(/^\d+\.\s*/, '');
    return cleaned.trim();
}
