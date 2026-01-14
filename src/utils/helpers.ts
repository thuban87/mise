/**
 * Mise Utility Functions
 */

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}

/**
 * Normalize a path for comparison
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Format time in minutes to human-readable string
 * @param minutes - Time in minutes
 * @returns Formatted string like "30 min" or "1h 30m"
 */
export function formatTime(minutes: number | null): string {
    if (minutes === null || minutes === 0) return '';

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${mins}m`;
}

/**
 * Format total time (prep + cook) to human-readable string
 */
export function formatTotalTime(prepTime: number | null, cookTime: number | null): string {
    const total = (prepTime || 0) + (cookTime || 0);
    return formatTime(total);
}

/**
 * Get emoji for recipe category
 */
export function getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
        'Main': '🍖',
        'Breakfast': '🍳',
        'Appetizer': '🥗',
        'Side': '🥔',
        'Dessert': '🍰',
        'Beverage': '🥤',
        'Snack': '🍿',
        'Uncategorized': '📝',
    };
    return emojiMap[category] || '📝';
}
