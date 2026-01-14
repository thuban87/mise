/**
 * RecipeGrid - Responsive grid container for recipe cards
 */

import { Recipe } from '../../types';
import { RecipeCard } from './RecipeCard';

interface RecipeGridProps {
    recipes: Recipe[];
}

export function RecipeGrid({ recipes }: RecipeGridProps) {
    return (
        <div className="mise-recipe-grid">
            {recipes.map((recipe) => (
                <RecipeCard key={recipe.path} recipe={recipe} />
            ))}
        </div>
    );
}
