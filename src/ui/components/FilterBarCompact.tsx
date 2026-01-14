/**
 * FilterBarCompact - Compact filter controls for sidebar view
 * 
 * Shows: search, category, time only
 */

import { useRecipes } from './RecipeContext';
import { RecipeCategory } from '../../types';

export function FilterBarCompact() {
    const {
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        maxTime,
        setMaxTime,
        categories,
    } = useRecipes();

    return (
        <div className="mise-filter-compact">
            {/* Search */}
            <input
                type="text"
                className="mise-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Category + Time in a row */}
            <div className="mise-filter-compact-row">
                <select
                    className="mise-filter-select-compact"
                    value={selectedCategory ?? ''}
                    onChange={(e) => setSelectedCategory(e.target.value as RecipeCategory || null)}
                >
                    <option value="">Category</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <select
                    className="mise-filter-select-compact"
                    value={maxTime ?? ''}
                    onChange={(e) => setMaxTime(e.target.value ? Number(e.target.value) : null)}
                >
                    <option value="">Time</option>
                    <option value="15">≤15m</option>
                    <option value="30">≤30m</option>
                    <option value="60">≤1h</option>
                </select>
            </div>
        </div>
    );
}
