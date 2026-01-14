/**
 * CookbookApp - Root React component for the cookbook view
 * 
 * Renders either a grid of recipe cards (full view) or a compact list (sidebar).
 */

import { useRecipes } from './RecipeContext';
import { RecipeGrid } from './RecipeGrid';
import { RecipeCardMini } from './RecipeCardMini';
import { RecipeModal } from './RecipeModal';
import { FilterBar } from './FilterBar';
import { FilterBarCompact } from './FilterBarCompact';

interface CookbookAppProps {
    compact?: boolean; // For sidebar layout
}

export function CookbookApp({ compact = false }: CookbookAppProps) {
    const { recipes, filteredRecipes, isLoading, hasActiveFilters } = useRecipes();

    if (isLoading) {
        return (
            <div className="mise-cookbook mise-loading">
                <div className="mise-loading-spinner"></div>
                <p>Loading recipes...</p>
            </div>
        );
    }

    if (recipes.length === 0) {
        return (
            <div className="mise-cookbook mise-empty">
                <div className="mise-empty-icon">📚</div>
                <h3>No recipes found</h3>
                <p>Add recipes to your configured recipe folder to get started.</p>
            </div>
        );
    }

    // Compact view for sidebar - mini cards with compact filters
    if (compact) {
        return (
            <>
                <div className="mise-cookbook mise-compact">
                    <header className="mise-header">
                        <h2>🍳 Recipes</h2>
                    </header>

                    <FilterBarCompact />

                    {filteredRecipes.length === 0 ? (
                        <div className="mise-empty mise-no-results-compact">
                            <p>No matches</p>
                        </div>
                    ) : (
                        <div className="mise-mini-list">
                            {filteredRecipes.map((recipe) => (
                                <RecipeCardMini key={recipe.path} recipe={recipe} />
                            ))}
                        </div>
                    )}
                </div>
                <RecipeModal />
            </>
        );
    }

    // Full view with filters
    return (
        <>
            <div className="mise-cookbook">
                <header className="mise-header">
                    <h2>🍳 Cookbook</h2>
                </header>

                <FilterBar />

                {filteredRecipes.length === 0 ? (
                    <div className="mise-empty mise-no-results">
                        <div className="mise-empty-icon">🔍</div>
                        <h3>No recipes match</h3>
                        <p>Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <RecipeGrid recipes={filteredRecipes} />
                )}
            </div>
            <RecipeModal />
        </>
    );
}
