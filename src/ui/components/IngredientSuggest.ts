/**
 * IngredientSuggest - Autocomplete component for ingredient input fields
 * 
 * Extends Obsidian's AbstractInputSuggest to provide ingredient suggestions
 * from the global ingredient index.
 */

import { AbstractInputSuggest, App } from 'obsidian';
import { IngredientIndexService, IndexedIngredient } from '../../services/IngredientIndexService';

export class IngredientSuggest extends AbstractInputSuggest<IndexedIngredient> {
    private ingredientIndex: IngredientIndexService;
    private textInputEl: HTMLInputElement;
    private selectCallback?: (ingredient: IndexedIngredient) => void;

    constructor(
        app: App,
        inputEl: HTMLInputElement,
        ingredientIndex: IngredientIndexService,
        onSelect?: (ingredient: IndexedIngredient) => void
    ) {
        super(app, inputEl);
        this.textInputEl = inputEl;
        this.ingredientIndex = ingredientIndex;
        this.selectCallback = onSelect;
    }

    /**
     * Get suggestions matching the input
     */
    getSuggestions(inputStr: string): IndexedIngredient[] {
        if (!this.ingredientIndex.isReady()) {
            return [];
        }
        return this.ingredientIndex.search(inputStr, 10);
    }

    /**
     * Render a suggestion item
     */
    renderSuggestion(ingredient: IndexedIngredient, el: HTMLElement): void {
        el.addClass('mise-ingredient-suggestion');

        // Main name
        const nameEl = el.createDiv({ cls: 'mise-suggestion-name' });
        nameEl.setText(ingredient.name);

        // Show aliases if any
        if (ingredient.aliases.length > 0) {
            const aliasEl = el.createDiv({ cls: 'mise-suggestion-aliases' });
            aliasEl.setText(`aka: ${ingredient.aliases.slice(0, 3).join(', ')}${ingredient.aliases.length > 3 ? '...' : ''}`);
        }

        // Show source indicator
        const sourceEl = el.createDiv({ cls: 'mise-suggestion-source' });
        const sources: string[] = [];
        if (ingredient.sources.includes('inventory')) sources.push('📦');
        if (ingredient.sources.includes('recipe')) sources.push('📖');
        if (ingredient.sources.includes('meal-log')) sources.push('🍽️');
        if (ingredient.sources.includes('manual')) sources.push('✏️');
        sourceEl.setText(sources.join(' '));
    }

    /**
     * Handle selection of a suggestion
     */
    selectSuggestion(ingredient: IndexedIngredient, evt: MouseEvent | KeyboardEvent): void {
        // Set the input value to the canonical name
        this.textInputEl.value = ingredient.name;
        this.textInputEl.trigger('input');

        // Call the onSelect callback if provided
        if (this.selectCallback) {
            this.selectCallback(ingredient);
        }

        this.close();
    }
}

/**
 * Simple inline ingredient autocomplete using a datalist
 * For cases where we just need basic autocomplete without the full suggest popup
 */
export function createIngredientDatalist(
    container: HTMLElement,
    id: string,
    ingredientIndex: IngredientIndexService
): HTMLDataListElement {
    const datalist = container.createEl('datalist', { attr: { id } });

    if (ingredientIndex.isReady()) {
        const ingredients = ingredientIndex.getAllIngredients();
        for (const ingredient of ingredients.slice(0, 100)) {
            datalist.createEl('option', { value: ingredient.name });
            // Add aliases as options too
            for (const alias of ingredient.aliases) {
                datalist.createEl('option', { value: alias });
            }
        }
    }

    return datalist;
}
