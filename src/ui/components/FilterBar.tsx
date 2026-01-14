/**
 * FilterBar - Search and filter controls for the cookbook view
 */

import { useRecipes, SortOption } from './RecipeContext';
import { RecipeCategory } from '../../types';

export function FilterBar() {
    const {
        recipes,
        filteredRecipes,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        minRating,
        setMinRating,
        maxTime,
        setMaxTime,
        selectedDietaryFlags,
        toggleDietaryFlag,
        unratedOnly,
        setUnratedOnly,
        missingImageOnly,
        setMissingImageOnly,
        sortOption,
        setSortOption,
        clearFilters,
        hasActiveFilters,
        categories,
        allDietaryFlags,
    } = useRecipes();

    return (
        <div className="mise-filter-bar">
            {/* Row 1: Search + Sort */}
            <div className="mise-filter-row">
                {/* Search Input */}
                <div className="mise-search-wrapper">
                    <input
                        type="text"
                        className="mise-search-input"
                        placeholder="Search recipes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="mise-search-clear"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Sort Dropdown */}
                <select
                    className="mise-filter-select"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                >
                    <option value="alpha">A-Z</option>
                    <option value="rating">Rating ↓</option>
                    <option value="time">Quickest</option>
                    <option value="recent">Recent</option>
                </select>
            </div>

            {/* Row 2: Category + Rating + Time */}
            <div className="mise-filter-row">
                {/* Category Filter */}
                <select
                    className="mise-filter-select"
                    value={selectedCategory ?? ''}
                    onChange={(e) => setSelectedCategory(e.target.value as RecipeCategory || null)}
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                {/* Rating Filter */}
                <select
                    className="mise-filter-select"
                    value={unratedOnly ? 'unrated' : minRating}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'unrated') {
                            setUnratedOnly(true);
                            setMinRating(0);
                        } else {
                            setUnratedOnly(false);
                            setMinRating(Number(val));
                        }
                    }}
                >
                    <option value="0">Any Rating</option>
                    <option value="5">5★ Only</option>
                    <option value="4">4★+</option>
                    <option value="3">3★+</option>
                    <option value="unrated">Unrated Only</option>
                </select>

                {/* Max Time Filter */}
                <select
                    className="mise-filter-select"
                    value={maxTime ?? ''}
                    onChange={(e) => setMaxTime(e.target.value ? Number(e.target.value) : null)}
                >
                    <option value="">Any Time</option>
                    <option value="15">≤ 15 min</option>
                    <option value="30">≤ 30 min</option>
                    <option value="60">≤ 1 hour</option>
                    <option value="120">≤ 2 hours</option>
                </select>
            </div>

            {/* Row 3: Dietary Chips */}
            {/* Dietary Chips */}
            {allDietaryFlags.length > 0 && (
                <div className="mise-filter-chips">
                    {allDietaryFlags.map((flag) => (
                        <button
                            key={flag}
                            className={`mise-filter-chip ${selectedDietaryFlags.includes(flag) ? 'active' : ''}`}
                            onClick={() => toggleDietaryFlag(flag)}
                        >
                            {flag}
                        </button>
                    ))}
                </div>
            )}

            {/* Maintenance Toggles */}
            <div className="mise-filter-toggles">
                <label className="mise-filter-toggle">
                    <input
                        type="checkbox"
                        checked={missingImageOnly}
                        onChange={(e) => setMissingImageOnly(e.target.checked)}
                    />
                    Missing Image
                </label>
            </div>

            {/* Row 4: Results + Clear */}
            <div className="mise-filter-row mise-filter-footer">
                <span className="mise-result-count">
                    {filteredRecipes.length === recipes.length
                        ? `${recipes.length} recipes`
                        : `Showing ${filteredRecipes.length} of ${recipes.length}`}
                </span>

                {hasActiveFilters && (
                    <button
                        className="mise-filter-clear"
                        onClick={clearFilters}
                    >
                        Clear Filters
                    </button>
                )}
            </div>
        </div>
    );
}
