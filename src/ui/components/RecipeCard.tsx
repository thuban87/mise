/**
 * RecipeCard - Visual card component for displaying a recipe
 */

import { Recipe } from '../../types';
import { formatTotalTime, getCategoryEmoji } from '../../utils/helpers';
import { useRecipes } from './RecipeContext';

interface RecipeCardProps {
    recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
    const { openModal, getImageUrl, getPlannedDays } = useRecipes();

    const imageUrl = getImageUrl(recipe.image);
    const totalTime = formatTotalTime(recipe.prepTime, recipe.cookTime);
    const categoryEmoji = getCategoryEmoji(recipe.category);
    const plannedDays = getPlannedDays(recipe.title);

    const handleClick = () => {
        openModal(recipe);
    };

    return (
        <div className="mise-card" onClick={handleClick}>
            {/* Image Section */}
            <div className="mise-card-image">
                {imageUrl ? (
                    <img src={imageUrl} alt={recipe.title} loading="lazy" />
                ) : (
                    <div className="mise-card-placeholder">
                        <span className="mise-placeholder-emoji">{categoryEmoji}</span>
                    </div>
                )}

                {/* Rating overlay */}
                {recipe.rating && (
                    <div className="mise-card-rating">
                        {'★'.repeat(recipe.rating)}
                        {'☆'.repeat(5 - recipe.rating)}
                    </div>
                )}

                {/* Planned badge */}
                {plannedDays && (
                    <div className="mise-card-planned">
                        📅 {plannedDays}
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="mise-card-content">
                <h3 className="mise-card-title">{recipe.title}</h3>

                <div className="mise-card-badges">
                    {/* Category */}
                    <span className="mise-badge mise-badge-category">
                        {categoryEmoji} {recipe.category}
                    </span>

                    {/* Time */}
                    {totalTime && (
                        <span className="mise-badge mise-badge-time">
                            ⏱️ {totalTime}
                        </span>
                    )}

                    {/* Servings */}
                    {recipe.servings && (
                        <span className="mise-badge mise-badge-servings">
                            🍽️ {recipe.servings}
                        </span>
                    )}
                </div>

                {/* Dietary Pills */}
                {recipe.dietaryFlags.length > 0 && (
                    <div className="mise-card-dietary">
                        {recipe.dietaryFlags.slice(0, 3).map((flag) => (
                            <span key={flag} className="mise-dietary-pill">
                                {flag}
                            </span>
                        ))}
                        {recipe.dietaryFlags.length > 3 && (
                            <span className="mise-dietary-pill mise-dietary-more">
                                +{recipe.dietaryFlags.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
