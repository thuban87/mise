/**
 * MealTypePicker - Quick picker for selecting meal type when dropping a recipe
 * Always centered on screen for consistent UX
 */

import { useEffect } from 'react';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

interface MealTypePickerProps {
    visible: boolean;
    onSelect: (mealType: MealType) => void;
    onCancel: () => void;
}

export function MealTypePicker({ visible, onSelect, onCancel }: MealTypePickerProps) {
    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        if (visible) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [visible, onCancel]);

    if (!visible) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="mise-picker-backdrop" onClick={onCancel} />

            {/* Picker - always centered */}
            <div className="mise-meal-picker mise-picker-centered">
                <div className="mise-picker-title">Add to...</div>
                <button
                    className="mise-picker-btn mise-picker-breakfast"
                    onClick={() => onSelect('breakfast')}
                >
                    🍳 Breakfast
                </button>
                <button
                    className="mise-picker-btn mise-picker-lunch"
                    onClick={() => onSelect('lunch')}
                >
                    🥗 Lunch
                </button>
                <button
                    className="mise-picker-btn mise-picker-dinner"
                    onClick={() => onSelect('dinner')}
                >
                    🍽️ Dinner
                </button>
                <button
                    className="mise-picker-btn mise-picker-cancel"
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </>
    );
}
