/**
 * CookbookApp - Root React component for the cookbook view
 * 
 * Renders either a grid of recipe cards (full view) or a compact list (sidebar).
 */

import { useRecipes } from './RecipeContext';
import { RecipeGrid } from './RecipeGrid';
import { RecipeCardMini } from './RecipeCardMini';

interface CookbookAppProps {
    compact?: boolean; // For sidebar layout
}

export function CookbookApp({ compact = false }: CookbookAppProps) {
    const { recipes, isLoading } = useRecipes();

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

    // Compact view for sidebar - use mini cards
    if (compact) {
        return (
            <div className="mise-cookbook mise-compact">
                <header className="mise-header">
                    <h2>🍳 Recipes</h2>
                    <span className="mise-recipe-count">{recipes.length}</span>
                </header>

                <div className="mise-mini-list">
                    {recipes.map((recipe) => (
                        <RecipeCardMini key={recipe.path} recipe={recipe} />
                    ))}
                </div>
            </div>
        );
    }

    // Full view - use card grid
    return (
        <div className="mise-cookbook">
            <header className="mise-header">
                <h2>🍳 Cookbook</h2>
                <span className="mise-recipe-count">{recipes.length} recipes</span>
            </header>

            <RecipeGrid recipes={recipes} />
        </div>
    );
}
