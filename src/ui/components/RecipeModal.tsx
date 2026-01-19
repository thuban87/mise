/**
 * RecipeModal - Full-screen recipe preview with interactive ingredients
 * Includes session-only scaling for cooking reference
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { Recipe } from '../../types';
import { formatTotalTime, getCategoryEmoji } from '../../utils/helpers';
import { useRecipes } from './RecipeContext';
import { parseIngredient, scaleQuantity, formatScaledIngredient, ParsedQuantity } from '../../utils/QuantityParser';

/**
 * Editable ingredient row data
 */
interface EditableIngredient {
    original: string;
    quantity: number;
    unit: string;
    name: string;
    checked: boolean;
}

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
        app,
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

    // Editable ingredients state
    const [editedIngredients, setEditedIngredients] = useState<EditableIngredient[]>([]);
    const [extraIngredients, setExtraIngredients] = useState<EditableIngredient[]>([]);

    // Instructions state
    const [instructionsExpanded, setInstructionsExpanded] = useState(false);
    const [instructions, setInstructions] = useState<string[]>([]);
    const [instructionsLoading, setInstructionsLoading] = useState(false);

    // Initialize/reset edited ingredients when recipe changes
    useEffect(() => {
        if (selectedRecipe) {
            const parsed = parseServings(selectedRecipe.servings);
            setTargetServings(parsed || 4);
            setIsScaling(false);
            setInstructionsExpanded(false);

            // Parse all ingredients into editable form
            const editable = selectedRecipe.ingredients.map((ing, index) => {
                const p = parseIngredient(ing);
                return {
                    original: ing,
                    quantity: p.value,
                    unit: p.unit || 'count',
                    name: p.ingredient,
                    checked: false,
                };
            });
            setEditedIngredients(editable);
            setExtraIngredients([]);
            setInstructions([]); // Reset instructions for new recipe
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

    // Load instructions when expanded
    useEffect(() => {
        if (!instructionsExpanded || !selectedRecipe?.path || instructions.length > 0) return;

        const loadInstructions = async () => {
            setInstructionsLoading(true);
            try {
                const file = app.vault.getAbstractFileByPath(selectedRecipe.path);
                if (file) {
                    const content = await app.vault.read(file as any);
                    // Parse instructions from markdown (handles emoji like "## 🍳 Instructions")
                    const instructionMatches = content.match(/##\s*[^\n]*?(Instructions|Directions|Steps|Method)\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
                    if (instructionMatches) {
                        const instructionText = instructionMatches[2].trim();
                        // Split into numbered steps or bullet points
                        const steps = instructionText
                            .split(/\n(?=\d+\.|\*|-|\+)/)
                            .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[-*+]\s*/, '').trim())
                            .filter(s => s.length > 0);
                        setInstructions(steps);
                    } else {
                        setInstructions(['No instructions section found in recipe']);
                    }
                }
            } catch (e) {
                console.error('Failed to load instructions:', e);
                setInstructions(['Failed to load instructions']);
            }
            setInstructionsLoading(false);
        };

        loadInstructions();
    }, [instructionsExpanded, selectedRecipe?.path, app, instructions.length]);

    // Calculate scale factor
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

                    {/* Ingredients with editable quantities */}
                    {editedIngredients.length > 0 && (
                        <div className="mise-modal-section">
                            <h3>
                                Ingredients
                                {isScaling && <span style={{ color: 'var(--text-accent)' }}> (Scaled)</span>}
                            </h3>
                            <div className="mise-editable-ingredients">
                                {editedIngredients.map((ing, index) => {
                                    const displayQty = isScaling ? ing.quantity * scaleFactor : ing.quantity;
                                    return (
                                        <div key={index} className={`mise-editable-ingredient-row ${ing.checked ? 'mise-ingredient-checked' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={ing.checked}
                                                onChange={(e) => {
                                                    const updated = [...editedIngredients];
                                                    updated[index].checked = e.target.checked;
                                                    setEditedIngredients(updated);
                                                }}
                                                className="mise-ingredient-checkbox-input"
                                            />
                                            <input
                                                type="number"
                                                value={displayQty.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}
                                                min="0"
                                                step="0.25"
                                                onChange={(e) => {
                                                    const updated = [...editedIngredients];
                                                    const newValue = parseFloat(e.target.value) || 0;
                                                    updated[index].quantity = isScaling ? newValue / scaleFactor : newValue;
                                                    setEditedIngredients(updated);
                                                }}
                                                className="mise-ingredient-qty-input"
                                            />
                                            <span className="mise-ingredient-unit">{ing.unit}</span>
                                            <span className="mise-ingredient-name">{ing.name}</span>
                                        </div>
                                    );
                                })}

                                {/* Extra ingredients */}
                                {extraIngredients.map((ing, index) => (
                                    <div key={`extra-${index}`} className="mise-editable-ingredient-row mise-extra-ingredient">
                                        <input
                                            type="checkbox"
                                            checked={ing.checked}
                                            onChange={(e) => {
                                                const updated = [...extraIngredients];
                                                updated[index].checked = e.target.checked;
                                                setExtraIngredients(updated);
                                            }}
                                            className="mise-ingredient-checkbox-input"
                                        />
                                        <input
                                            type="number"
                                            value={ing.quantity}
                                            min="0"
                                            step="0.25"
                                            onChange={(e) => {
                                                const updated = [...extraIngredients];
                                                updated[index].quantity = parseFloat(e.target.value) || 0;
                                                setExtraIngredients(updated);
                                            }}
                                            className="mise-ingredient-qty-input"
                                        />
                                        <input
                                            type="text"
                                            value={ing.unit}
                                            placeholder="unit"
                                            onChange={(e) => {
                                                const updated = [...extraIngredients];
                                                updated[index].unit = e.target.value;
                                                setExtraIngredients(updated);
                                            }}
                                            className="mise-ingredient-unit-input"
                                        />
                                        <input
                                            type="text"
                                            value={ing.name}
                                            placeholder="Item name..."
                                            onChange={(e) => {
                                                const updated = [...extraIngredients];
                                                updated[index].name = e.target.value;
                                                setExtraIngredients(updated);
                                            }}
                                            className="mise-ingredient-name-input"
                                        />
                                        <button
                                            className="mise-btn-icon"
                                            onClick={() => {
                                                setExtraIngredients(extraIngredients.filter((_, i) => i !== index));
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}

                                <button
                                    className="mise-btn mise-btn-small"
                                    onClick={() => {
                                        setExtraIngredients([...extraIngredients, {
                                            original: '',
                                            quantity: 1,
                                            unit: 'oz',
                                            name: '',
                                            checked: true,
                                        }]);
                                    }}
                                    style={{ marginTop: '8px' }}
                                >
                                    + Add Extra Item
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Collapsible Instructions */}
                    {recipe.path && (
                        <div className="mise-modal-section">
                            <h3
                                className="mise-collapsible-header"
                                onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                            >
                                {instructionsExpanded ? '▼' : '▶'} Instructions
                            </h3>
                            {instructionsExpanded && (
                                <div className="mise-instructions-content">
                                    {instructionsLoading ? (
                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            Loading instructions...
                                        </p>
                                    ) : instructions.length > 0 ? (
                                        <ol className="mise-instructions-list">
                                            {instructions.map((step, index) => (
                                                <li key={index} className="mise-instruction-step">
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            No instructions found.
                                        </p>
                                    )}
                                </div>
                            )}
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
                                // Pass edited + extra ingredients to logMeal
                                logMeal(recipe, [...editedIngredients, ...extraIngredients]);
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
