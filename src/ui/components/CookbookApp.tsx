/**
 * CookbookApp - Root React component for the cookbook view
 * 
 * Renders a list of recipes from the indexer. This is the proof-of-concept
 * for Phase 5 that demonstrates data flow from the indexer to React.
 */

import { useRecipes } from './RecipeContext';

interface CookbookAppProps {
    compact?: boolean; // For sidebar layout
}

export function CookbookApp({ compact = false }: CookbookAppProps) {
    const { recipes, isLoading, openRecipe } = useRecipes();

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

    return (
        <div className={`mise-cookbook ${compact ? 'mise-compact' : ''}`}>
            <header className="mise-header">
                <h2>🍳 Cookbook</h2>
                <span className="mise-recipe-count">{recipes.length} recipes</span>
            </header>

            <div className="mise-recipe-list">
                {recipes.map((recipe) => (
                    <div
                        key={recipe.path}
                        className="mise-recipe-item"
                        onClick={() => openRecipe(recipe.path)}
                    >
                        <span className="mise-recipe-title">{recipe.title}</span>
                        <span className="mise-recipe-category">{recipe.category}</span>
                        {recipe.rating && (
                            <span className="mise-recipe-rating">
                                {'⭐'.repeat(recipe.rating)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
