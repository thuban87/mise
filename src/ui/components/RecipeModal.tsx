/**
 * RecipeModal - Full-screen recipe preview with interactive ingredients
 */

import { useEffect, useCallback } from 'react';
import { Recipe } from '../../types';
import { formatTotalTime, getCategoryEmoji } from '../../utils/helpers';
import { useRecipes } from './RecipeContext';

export function RecipeModal() {
    const {
        selectedRecipe,
        closeModal,
        openRecipe,
        getImageUrl,
        isIngredientChecked,
        toggleIngredient,
    } = useRecipes();

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };

        if (selectedRecipe) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedRecipe, closeModal]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    }, [closeModal]);

    if (!selectedRecipe) {
        return null;
    }

    const recipe = selectedRecipe;
    const imageUrl = getImageUrl(recipe.image);
    const totalTime = formatTotalTime(recipe.prepTime, recipe.cookTime);
    const categoryEmoji = getCategoryEmoji(recipe.category);

    return (
        <div className="mise-modal-backdrop" onClick={handleBackdropClick}>
            <div className="mise-modal">
                {/* Header with image */}
                <div className="mise-modal-header">
                    {imageUrl ? (
                        <img src={imageUrl} alt={recipe.title} className="mise-modal-image" />
                    ) : (
                        <div className="mise-modal-placeholder">
                            <span>{categoryEmoji}</span>
                        </div>
                    )}
                    <button className="mise-modal-close" onClick={closeModal} aria-label="Close">
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="mise-modal-content">
                    {/* Title and rating */}
                    <h2 className="mise-modal-title">{recipe.title}</h2>
                    {recipe.rating && (
                        <div className="mise-modal-rating">
                            {'★'.repeat(recipe.rating)}
                            {'☆'.repeat(5 - recipe.rating)}
                        </div>
                    )}

                    {/* Badges */}
                    <div className="mise-modal-badges">
                        <span className="mise-badge mise-badge-category">
                            {categoryEmoji} {recipe.category}
                        </span>
                        {totalTime && (
                            <span className="mise-badge mise-badge-time">
                                ⏱️ {totalTime}
                            </span>
                        )}
                        {recipe.servings && (
                            <span className="mise-badge mise-badge-servings">
                                🍽️ {recipe.servings}
                            </span>
                        )}
                    </div>

                    {/* Dietary flags */}
                    {recipe.dietaryFlags.length > 0 && (
                        <div className="mise-modal-dietary">
                            {recipe.dietaryFlags.map((flag) => (
                                <span key={flag} className="mise-dietary-pill">
                                    {flag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Ingredients with checkboxes */}
                    {recipe.ingredients.length > 0 && (
                        <div className="mise-modal-section">
                            <h3>Ingredients</h3>
                            <ul className="mise-ingredient-list">
                                {recipe.ingredients.map((ingredient, index) => {
                                    const isChecked = isIngredientChecked(recipe.path, index);
                                    return (
                                        <li
                                            key={index}
                                            className={`mise-ingredient-item ${isChecked ? 'mise-ingredient-checked' : ''}`}
                                            onClick={() => toggleIngredient(recipe.path, index)}
                                        >
                                            <span className="mise-ingredient-checkbox">
                                                {isChecked ? '☑' : '☐'}
                                            </span>
                                            <span className="mise-ingredient-text">
                                                {ingredient}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="mise-modal-actions">
                        <button
                            className="mise-btn mise-btn-primary"
                            onClick={() => {
                                openRecipe(recipe.path);
                                closeModal();
                            }}
                        >
                            📝 Open Recipe
                        </button>
                        <button
                            className="mise-btn mise-btn-secondary"
                            disabled
                            title="Coming soon in Phase 11"
                        >
                            📅 Add to Meal Plan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
