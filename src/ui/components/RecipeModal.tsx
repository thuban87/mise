/**
 * RecipeModal - Full-screen recipe preview with interactive ingredients
 * Includes session-only scaling for cooking reference
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { Recipe } from '../../types';
import { formatTotalTime, getCategoryEmoji } from '../../utils/helpers';
import { useRecipes } from './RecipeContext';
import { parseIngredient, scaleQuantity, formatScaledIngredient } from '../../utils/QuantityParser';

/**
 * Parse servings string to a number
 */
function parseServings(servingsStr: string | undefined): number | null {
    if (!servingsStr) return null;
    const match = servingsStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

export function RecipeModal() {
    const {
        selectedRecipe,
        closeModal,
        openRecipe,
        getImageUrl,
        isIngredientChecked,
        toggleIngredient,
        logMeal,
    } = useRecipes();

    // Scaling state (session-only, resets when modal closes)
    const [isScaling, setIsScaling] = useState(false);
    const [targetServings, setTargetServings] = useState<number>(4);

    // Reset scaling state when recipe changes
    useEffect(() => {
        if (selectedRecipe) {
            const parsed = parseServings(selectedRecipe.servings);
            setTargetServings(parsed || 4);
            setIsScaling(false);
        }
    }, [selectedRecipe]);

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

    // Calculate scale factor and scaled ingredients
    const currentServings = selectedRecipe ? parseServings(selectedRecipe.servings) : null;
    const scaleFactor = currentServings && targetServings
        ? targetServings / currentServings
        : 1;

    const scaledIngredients = useMemo(() => {
        if (!selectedRecipe || !isScaling || scaleFactor === 1) {
            return selectedRecipe?.ingredients || [];
        }

        return selectedRecipe.ingredients.map(ingredient => {
            const parsed = parseIngredient(ingredient);
            const scaled = scaleQuantity(parsed, scaleFactor);
            return formatScaledIngredient(scaled);
        });
    }, [selectedRecipe, isScaling, scaleFactor]);

    if (!selectedRecipe) {
        return null;
    }

    const recipe = selectedRecipe;
    const imageUrl = getImageUrl(recipe.image);
    const totalTime = formatTotalTime(recipe.prepTime, recipe.cookTime);
    const categoryEmoji = getCategoryEmoji(recipe.category);
    const displayIngredients = isScaling ? scaledIngredients : recipe.ingredients;

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
                                🍽️ {isScaling ? `${targetServings} (scaled)` : recipe.servings}
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

                    {/* Scaling controls */}
                    {currentServings && (
                        <div className="mise-modal-scale-section">
                            <div className="mise-modal-scale-controls">
                                <button
                                    className={`mise-btn ${isScaling ? 'mise-btn-primary' : 'mise-btn-secondary'}`}
                                    onClick={() => setIsScaling(!isScaling)}
                                >
                                    ⚖️ {isScaling ? 'Reset' : 'Scale'}
                                </button>
                                {isScaling && (
                                    <>
                                        <label>Target servings:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={targetServings}
                                            onChange={(e) => setTargetServings(parseInt(e.target.value) || 1)}
                                        />
                                        <span className="mise-modal-scale-factor">
                                            ({scaleFactor.toFixed(2)}x)
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Ingredients with checkboxes */}
                    {displayIngredients.length > 0 && (
                        <div className="mise-modal-section">
                            <h3>Ingredients {isScaling && <span style={{ color: 'var(--text-accent)' }}>(Scaled)</span>}</h3>
                            <ul className="mise-ingredient-list">
                                {displayIngredients.map((ingredient, index) => {
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
                            title="Coming soon"
                        >
                            📅 Add to Meal Plan
                        </button>
                        <button
                            className="mise-btn mise-btn-secondary"
                            onClick={() => {
                                closeModal();
                                logMeal(recipe);
                            }}
                            title="Log this meal and deduct ingredients from inventory"
                        >
                            ✅ Finish & Log
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
