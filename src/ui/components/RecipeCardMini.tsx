/**
 * RecipeCardMini - Compact card for sidebar view
 * 
 * Shows: small thumbnail, title, rating, time
 */

import { Recipe } from '../../types';
import { formatTotalTime, getCategoryEmoji } from '../../utils/helpers';
import { useRecipes } from './RecipeContext';

interface RecipeCardMiniProps {
    recipe: Recipe;
}

export function RecipeCardMini({ recipe }: RecipeCardMiniProps) {
    const { openModal, getImageUrl } = useRecipes();

    const imageUrl = getImageUrl(recipe.image);
    const totalTime = formatTotalTime(recipe.prepTime, recipe.cookTime);
    const categoryEmoji = getCategoryEmoji(recipe.category);

    const handleClick = () => {
        openModal(recipe);
    };

    return (
        <div className="mise-card-mini" onClick={handleClick}>
            {/* Thumbnail */}
            <div className="mise-mini-image">
                {imageUrl ? (
                    <img src={imageUrl} alt={recipe.title} loading="lazy" />
                ) : (
                    <div className="mise-mini-placeholder">
                        <span>{categoryEmoji}</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="mise-mini-content">
                <span className="mise-mini-title">{recipe.title}</span>
                <div className="mise-mini-meta">
                    {recipe.rating && (
                        <span className="mise-mini-rating">
                            {'★'.repeat(recipe.rating)}
                        </span>
                    )}
                    {totalTime && (
                        <span className="mise-mini-time">⏱️ {totalTime}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
