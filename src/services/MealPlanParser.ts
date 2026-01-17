/**
 * MealPlanParser - Parse meal plan markdown files
 * 
 * Expected format:
 * # Meal Plan - January 2026
 * ## Week 1 (Jan 1-7)
 * ### 🍳 Breakfast
 * | Day | Meal | Protein | Side 1 | Side 2 | Notes |
 * |-----|------|---------|--------|--------|-------|
 * | Mon | [[Pancakes]] | - | Syrup | - | |
 */

import { PlannedMeal } from '../types';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface ParsedMealPlan {
    /** Month header (e.g., "January 2026") */
    month: string;
    /** All parsed meals */
    meals: PlannedMeal[];
    /** Map of recipe name -> array of planned meals */
    recipeMap: Map<string, PlannedMeal[]>;
}

/**
 * Parse a meal plan markdown file content
 */
export function parseMealPlan(content: string): ParsedMealPlan {
    const meals: PlannedMeal[] = [];
    const recipeMap = new Map<string, PlannedMeal[]>();

    // Extract month/year from various formats:
    // 1. "# Meal Plan - January 2026" (old format)
    // 2. "# January 2026 Meal Plan" (generated format)
    // 3. Frontmatter: "month: January"

    let month = 'Unknown';
    let year = new Date().getFullYear();

    // Try format: "# Meal Plan - January 2026"
    const monthMatch1 = content.match(/^#\s+Meal Plan\s*[-–—]?\s*\[?(\w+)[,\s]+(\d{4})\]?/m);
    if (monthMatch1) {
        month = monthMatch1[1].trim();
        year = parseInt(monthMatch1[2], 10);
    }

    // Try format: "# January 2026 Meal Plan"
    if (month === 'Unknown') {
        const monthMatch2 = content.match(/^#\s+(\w+)\s+(\d{4})\s+Meal Plan/m);
        if (monthMatch2) {
            month = monthMatch2[1].trim();
            year = parseInt(monthMatch2[2], 10);
        }
    }

    // Try frontmatter: "month: January"
    if (month === 'Unknown') {
        const fmMatch = content.match(/^---[\s\S]*?month:\s*(\w+)[\s\S]*?year:\s*(\d+)[\s\S]*?---/m);
        if (fmMatch) {
            month = fmMatch[1].trim();
            year = parseInt(fmMatch[2], 10);
        }
    }

    // Current context
    let currentMealType: MealType | null = null;
    let currentWeekNumber = 1;

    const lines = content.split('\n');

    for (const line of lines) {
        // Skip header lines (# Meal Plan - ...)
        if (line.trim().startsWith('#')) {
            // Check for week headers (## Week 1, ## Week 2, etc.)
            const weekMatch = line.match(/^##\s+Week\s+(\d+)/i);
            if (weekMatch) {
                currentWeekNumber = parseInt(weekMatch[1], 10);
            }
            // Check for meal section headers (### Breakfast, etc.)
            const mealHeader = parseMealHeader(line);
            if (mealHeader) {
                currentMealType = mealHeader;
            }
            continue;
        }

        // Parse table rows
        if (currentMealType && line.trim().startsWith('|') && !line.includes('---')) {
            const meal = parseTableRow(line, currentMealType, currentWeekNumber, month, year);
            if (meal && meal.recipeTitle && meal.recipeTitle !== '-') {
                meals.push(meal);

                // Add to recipe map (keyed by lowercase title for matching)
                const key = meal.recipeTitle.toLowerCase();
                if (!recipeMap.has(key)) {
                    recipeMap.set(key, []);
                }
                recipeMap.get(key)!.push(meal);
            }
        }
    }

    return { month, meals, recipeMap };
}

/**
 * Parse meal section header (### 🍳 Breakfast)
 */
function parseMealHeader(line: string): MealType | null {
    const trimmed = line.trim().toLowerCase();

    if (trimmed.includes('breakfast')) return 'breakfast';
    if (trimmed.includes('lunch')) return 'lunch';
    if (trimmed.includes('dinner')) return 'dinner';

    return null;
}

/**
 * Parse a table row into a PlannedMeal
 * Expected: | Day | Meal | Protein | Side 1 | Side 2 | Notes |
 */
function parseTableRow(line: string, mealType: MealType, weekNumber: number, planMonth: string, planYear: number): PlannedMeal | null {
    // Split by | and trim
    const cells = line.split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);

    // Skip header row
    if (cells.length < 2 || cells[0].toLowerCase() === 'day') {
        return null;
    }

    const day = cells[0] || '';
    const mealCell = cells[1] || '';
    const protein = cells[2] || undefined;
    const side1 = cells[3] || undefined;
    const side2 = cells[4] || undefined;
    const notes = cells[5] || undefined;

    // Extract wikilink if present
    const { title, path } = extractWikilink(mealCell);

    // Skip empty, dash entries, header text, or month names
    if (!title || title === '-' || title.toLowerCase() === 'meal') {
        return null;
    }

    // Skip if title contains month names (header leftovers)
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    if (monthNames.some(m => title.toLowerCase().includes(m))) {
        return null;
    }

    // Skip if title contains year (like "2026")
    if (/\d{4}/.test(title)) {
        return null;
    }

    return {
        recipePath: path,
        recipeTitle: title,
        day: normalizeDay(day),
        weekNumber,
        planMonth,
        planYear,
        mealType,
        protein: cleanCellValue(protein),
        side1: cleanCellValue(side1),
        side2: cleanCellValue(side2),
        notes: cleanCellValue(notes),
    };
}

/**
 * Extract title and path from potential wikilink
 * [[Recipe Name]] -> { title: "Recipe Name", path: "Recipe Name.md" }
 * Plain text -> { title: "Plain text", path: null }
 */
function extractWikilink(text: string): { title: string; path: string | null } {
    // Remove markdown bold/italic
    const cleaned = text.replace(/\*+/g, '').trim();

    // Check for wikilink - must have DOUBLE brackets
    const match = cleaned.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (match) {
        const linkTarget = match[1].trim();
        const displayText = match[2]?.trim() || linkTarget;
        return {
            title: displayText,
            path: linkTarget.endsWith('.md') ? linkTarget : `${linkTarget}.md`,
        };
    }

    // Check for single brackets (like [January, 2026]) - treat as plain text, not link
    // This prevents header text from being parsed as a meal
    if (cleaned.startsWith('[') && cleaned.endsWith(']') && !cleaned.includes('[[')) {
        return { title: '', path: null };
    }

    return { title: cleaned, path: null };
}

/**
 * Normalize day abbreviations
 */
function normalizeDay(day: string): string {
    const cleaned = day.replace(/\*+/g, '').trim().toLowerCase();

    const dayMap: Record<string, string> = {
        'mon': 'Mon', 'monday': 'Mon',
        'tue': 'Tue', 'tuesday': 'Tue',
        'wed': 'Wed', 'wednesday': 'Wed',
        'thu': 'Thu', 'thursday': 'Thu',
        'fri': 'Fri', 'friday': 'Fri',
        'sat': 'Sat', 'saturday': 'Sat',
        'sun': 'Sun', 'sunday': 'Sun',
    };

    return dayMap[cleaned] || day;
}

/**
 * Clean cell value (remove markdown formatting, handle dashes)
 */
function cleanCellValue(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const cleaned = value.replace(/\*+/g, '').trim();
    if (cleaned === '-' || cleaned === '*None*' || cleaned === 'None' || cleaned === '') {
        return undefined;
    }

    return cleaned;
}

/**
 * Get all planned days for a recipe by title
 */
export function getPlannedDaysForRecipe(
    recipeMap: Map<string, PlannedMeal[]>,
    recipeTitle: string
): PlannedMeal[] {
    return recipeMap.get(recipeTitle.toLowerCase()) || [];
}
