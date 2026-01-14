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
