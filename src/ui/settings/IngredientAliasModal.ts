/**
 * IngredientAliasModal - Modal for managing ingredient aliases
 *
 * Allows users to:
 * - View all indexed ingredients
 * - Add aliases to ingredients
 * - Remove aliases
 * - Merge ingredients
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { IngredientIndexService, IndexedIngredient } from '../../services/IngredientIndexService';

export class IngredientAliasModal extends Modal {
    private ingredientIndex: IngredientIndexService;
    private searchQuery: string = '';
    private filteredIngredients: IndexedIngredient[] = [];

    constructor(app: App, ingredientIndex: IngredientIndexService) {
        super(app);
        this.ingredientIndex = ingredientIndex;
    }

    onOpen() {
        this.render();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-alias-modal');

        contentEl.createEl('h2', { text: '🥘 Ingredient Aliases' });
        contentEl.createEl('p', {
            text: 'Add aliases for ingredients to improve matching. For example, "NY strip" → "new york strip steak".',
            cls: 'mise-modal-description'
        });

        // Search input
        const searchSetting = new Setting(contentEl)
            .setName('Search ingredients')
            .addText(text => {
                text
                    .setPlaceholder('Type to filter...')
                    .setValue(this.searchQuery)
                    .onChange(value => {
                        this.searchQuery = value;
                        this.updateFilteredIngredients();
                        this.renderIngredientList(listContainer);
                    });
            });

        // Stats
        const stats = contentEl.createDiv('mise-alias-stats');
        const allIngredients = this.ingredientIndex.getAllIngredients();
        const withAliases = allIngredients.filter(i => i.aliases.length > 0);
        stats.setText(`${allIngredients.length} ingredients indexed • ${withAliases.length} with aliases`);
        stats.style.marginBottom = '16px';
        stats.style.color = 'var(--text-muted)';
        stats.style.fontSize = '0.85em';

        // Ingredient list container
        const listContainer = contentEl.createDiv('mise-alias-list');
        listContainer.style.maxHeight = '400px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.marginBottom = '16px';

        this.updateFilteredIngredients();
        this.renderIngredientList(listContainer);

        // Close button
        const buttonContainer = contentEl.createDiv('mise-modal-nav');
        buttonContainer.style.paddingTop = '16px';
        buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';

        const closeBtn = buttonContainer.createEl('button', {
            text: 'Close',
            cls: 'mod-cta'
        });
        closeBtn.onclick = () => this.close();
    }

    private updateFilteredIngredients() {
        const all = this.ingredientIndex.getAllIngredients();
        if (!this.searchQuery) {
            // Sort by most aliases first, then alphabetically
            this.filteredIngredients = all
                .sort((a, b) => {
                    if (b.aliases.length !== a.aliases.length) {
                        return b.aliases.length - a.aliases.length;
                    }
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 50); // Limit for performance
        } else {
            const query = this.searchQuery.toLowerCase();
            this.filteredIngredients = all
                .filter(i =>
                    i.name.toLowerCase().includes(query) ||
                    i.aliases.some(a => a.toLowerCase().includes(query))
                )
                .slice(0, 50);
        }
    }

    private renderIngredientList(container: HTMLElement) {
        container.empty();

        if (this.filteredIngredients.length === 0) {
            container.createEl('p', {
                text: 'No ingredients found.',
                cls: 'mise-text-muted'
            });
            return;
        }

        for (const ingredient of this.filteredIngredients) {
            const itemDiv = container.createDiv('mise-alias-item');
            itemDiv.style.padding = '12px';
            itemDiv.style.marginBottom = '8px';
            itemDiv.style.background = 'var(--background-secondary)';
            itemDiv.style.borderRadius = '6px';

            // Header row with name
            const headerRow = itemDiv.createDiv();
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.marginBottom = '8px';

            const nameEl = headerRow.createEl('strong', { text: ingredient.name });
            nameEl.style.fontSize = '1em';

            // Sources indicators
            const sourceEl = headerRow.createEl('span');
            sourceEl.style.fontSize = '0.8em';
            sourceEl.style.color = 'var(--text-muted)';
            const sourceIcons: string[] = [];
            if (ingredient.sources.includes('inventory')) sourceIcons.push('📦');
            if (ingredient.sources.includes('recipe')) sourceIcons.push('📖');
            if (ingredient.sources.includes('meal-log')) sourceIcons.push('🍽️');
            sourceEl.setText(sourceIcons.join(' '));

            // Aliases section
            if (ingredient.aliases.length > 0) {
                const aliasContainer = itemDiv.createDiv();
                aliasContainer.style.display = 'flex';
                aliasContainer.style.flexWrap = 'wrap';
                aliasContainer.style.gap = '6px';
                aliasContainer.style.marginBottom = '8px';

                for (const alias of ingredient.aliases) {
                    const chip = aliasContainer.createEl('span');
                    chip.style.display = 'inline-flex';
                    chip.style.alignItems = 'center';
                    chip.style.gap = '4px';
                    chip.style.padding = '2px 8px';
                    chip.style.background = 'var(--background-primary)';
                    chip.style.borderRadius = '12px';
                    chip.style.fontSize = '0.85em';
                    chip.createEl('span', { text: alias });

                    const removeBtn = chip.createEl('button', { text: '×' });
                    removeBtn.style.border = 'none';
                    removeBtn.style.background = 'none';
                    removeBtn.style.cursor = 'pointer';
                    removeBtn.style.padding = '0 2px';
                    removeBtn.style.color = 'var(--text-muted)';
                    removeBtn.style.fontSize = '1em';
                    removeBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await this.ingredientIndex.removeAlias(ingredient.name, alias);
                        new Notice(`Removed alias "${alias}"`);
                        this.updateFilteredIngredients();
                        this.renderIngredientList(container);
                    };
                }
            }

            // Add alias input
            const addRow = itemDiv.createDiv();
            addRow.style.display = 'flex';
            addRow.style.gap = '8px';
            addRow.style.alignItems = 'center';

            const aliasInput = addRow.createEl('input', {
                type: 'text',
                placeholder: 'Add alias...'
            });
            aliasInput.style.flex = '1';
            aliasInput.style.padding = '6px 10px';
            aliasInput.style.border = '1px solid var(--background-modifier-border)';
            aliasInput.style.borderRadius = '4px';
            aliasInput.style.background = 'var(--background-primary)';
            aliasInput.style.fontSize = '0.9em';

            const addBtn = addRow.createEl('button', { text: 'Add' });
            addBtn.onclick = async () => {
                const newAlias = aliasInput.value.trim();
                if (!newAlias) {
                    new Notice('Please enter an alias');
                    return;
                }
                const success = await this.ingredientIndex.addAlias(ingredient.name, newAlias);
                if (success) {
                    new Notice(`Added alias "${newAlias}" for ${ingredient.name}`);
                    aliasInput.value = '';
                    this.updateFilteredIngredients();
                    this.renderIngredientList(container);
                } else {
                    new Notice(`Could not add alias - may already exist for another ingredient`);
                }
            };

            // Allow Enter key to add alias
            aliasInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    addBtn.click();
                }
            };

            // Merge with another ingredient
            const mergeRow = itemDiv.createDiv();
            mergeRow.style.display = 'flex';
            mergeRow.style.flexWrap = 'wrap';
            mergeRow.style.gap = '8px';
            mergeRow.style.alignItems = 'center';
            mergeRow.style.marginTop = '8px';
            mergeRow.style.paddingTop = '8px';
            mergeRow.style.borderTop = '1px solid var(--background-modifier-border)';

            const mergeLabel = mergeRow.createEl('span', { text: 'Merge:' });
            mergeLabel.style.fontSize = '0.85em';
            mergeLabel.style.color = 'var(--text-muted)';
            mergeLabel.style.flexShrink = '0';

            // Autocomplete text input with datalist
            const mergeInput = mergeRow.createEl('input', {
                type: 'text',
                placeholder: 'Type to find ingredient...'
            });
            mergeInput.style.flex = '1';
            mergeInput.style.minWidth = '120px';
            mergeInput.style.padding = '4px 8px';
            mergeInput.style.borderRadius = '4px';
            mergeInput.style.border = '1px solid var(--background-modifier-border)';
            mergeInput.style.background = 'var(--background-primary)';
            mergeInput.style.fontSize = '0.85em';

            // Create datalist for autocomplete
            const datalistId = `merge-${ingredient.name.replace(/\s+/g, '-')}`;
            const datalist = mergeRow.createEl('datalist');
            datalist.id = datalistId;
            mergeInput.setAttribute('list', datalistId);

            // Populate datalist with other ingredients (excluding self)
            const allIngredients = this.ingredientIndex.getAllIngredients()
                .filter(i => i.name !== ingredient.name)
                .sort((a, b) => a.name.localeCompare(b.name));

            for (const other of allIngredients) {
                datalist.createEl('option', { value: other.name });
            }

            const mergeBtn = mergeRow.createEl('button', { text: 'Merge' });
            mergeBtn.style.flexShrink = '0';
            mergeBtn.onclick = async () => {
                const selectedName = mergeInput.value.trim();
                if (!selectedName) {
                    new Notice('Please enter an ingredient to merge with');
                    return;
                }

                // Verify the ingredient exists
                const targetExists = allIngredients.some(i => i.name === selectedName);
                if (!targetExists) {
                    new Notice(`Ingredient "${selectedName}" not found in index`);
                    return;
                }

                // Merge: keep current ingredient, absorb selected one
                const success = await this.ingredientIndex.mergeIngredients(ingredient.name, selectedName);
                if (success) {
                    new Notice(`Merged "${selectedName}" into "${ingredient.name}"`);
                    this.updateFilteredIngredients();
                    this.renderIngredientList(container);
                } else {
                    new Notice('Failed to merge ingredients');
                }
            };
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
