/**
 * FrontmatterParser (Placeholder)
 * 
 * This module will be fully implemented in Phase 4.
 * Pure functions for normalizing recipe frontmatter values.
 */

import { RecipeCategory, DietaryFlag } from '../types';

/**
 * Parse time string to minutes
 * Examples: "5 mins", "1 hour 30 minutes", "90", "1h 30m"
 */
export function parseTime(timeStr: string | number | undefined | null): number | null {
    if (timeStr === undefined || timeStr === null || timeStr === '') {
        return null;
    }

    // Already a number
    if (typeof timeStr === 'number') {
        return timeStr;
    }

    const str = String(timeStr).toLowerCase().trim();

    // Pure number (assume minutes)
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }

    let totalMinutes = 0;

    // Match hours
    const hourMatch = str.match(/(\d+)\s*(?:hours?|hrs?|h)/);
    if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1], 10) * 60;
    }

    // Match minutes
    const minMatch = str.match(/(\d+)\s*(?:minutes?|mins?|m(?!o))/);
    if (minMatch) {
        totalMinutes += parseInt(minMatch[1], 10);
    }

    return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Format minutes to human-readable string
 */
export function formatTime(minutes: number | null): string {
    if (minutes === null || minutes === 0) {
        return '';
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
        return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else if (mins === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
        return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
}

/**
 * Validate and normalize recipe category
 */
export function parseCategory(category: string | undefined | null): RecipeCategory {
    if (!category) {
        return 'Uncategorized';
    }

    const normalized = category.trim();
    const validCategories: RecipeCategory[] = [
        'Main', 'Breakfast', 'Appetizer', 'Side', 'Dessert', 'Beverage', 'Snack'
    ];

    if (validCategories.includes(normalized as RecipeCategory)) {
        return normalized as RecipeCategory;
    }

    return 'Uncategorized';
}

/**
 * Parse rating value
 */
export function parseRating(rating: string | number | undefined | null): number | null {
    if (rating === undefined || rating === null || rating === '') {
        return null;
    }

    const num = typeof rating === 'number' ? rating : parseInt(String(rating), 10);

    if (isNaN(num) || num < 1 || num > 5) {
        return null;
    }

    return num;
}

/**
 * Parse dietary flags from frontmatter array
 */
export function parseDietaryFlags(flags: string[] | undefined | null): DietaryFlag[] {
    if (!flags || !Array.isArray(flags)) {
        return [];
    }

    const validFlags: DietaryFlag[] = [
        'crohns-safe', 'low-fiber', 'high-fiber', 'high-protein',
        'high-carb', 'low-carb', 'dairy-free', 'gluten-free',
        'vegetarian', 'vegan', 'keto', 'paleo'
    ];

    return flags
        .map(f => f.toLowerCase().trim())
        .filter((f): f is DietaryFlag => validFlags.includes(f as DietaryFlag));
}
