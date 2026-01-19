/**
 * LogMealModal - Log a meal and deduct ingredients from inventory
 * 
 * Shows:
 * 1. Today's scheduled meals (Breakfast/Lunch/Dinner)
 * 2. Option to choose from cookbook
 * 3. Ingredient confirmation with quantity override
 * 4. Writes to Meal Log.md for calorie tracking
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { MiseSettings, PlannedMeal, Recipe } from '../../types';
import { MealPlanService } from '../../services/MealPlanService';
import { InventoryService } from '../../services/InventoryService';
import { IngredientIndexService } from '../../services/IngredientIndexService';
import { RecipeIndexer } from '../../services/RecipeIndexer';
import { parseIngredients } from '../../parsers/IngredientParser';
import { parseIngredient } from '../../utils/QuantityParser';

interface IngredientSelection {
    original: string;
    checked: boolean;
    quantity: number;
    unit: string;
    name: string;
}

export class LogMealModal extends Modal {
    private settings: MiseSettings;
    private mealPlanService: MealPlanService;
    private inventoryService: InventoryService;
    private ingredientIndex: IngredientIndexService;
    private indexer: RecipeIndexer;
    private preSelectedRecipe: Recipe | null;
    private prePopulatedIngredients: { quantity: number; unit: string; name: string; checked: boolean }[] | undefined;

    // State
    private step: 'select' | 'confirm' = 'select';
    private selectedRecipe: Recipe | null = null;
    private selectedMealType: 'breakfast' | 'lunch' | 'dinner' = 'lunch';
    private ingredients: IngredientSelection[] = [];
    private customIngredients: IngredientSelection[] = []; // User-added substitutions
    private upcomingMeals: PlannedMeal[] = [];

    constructor(
        app: App,
        settings: MiseSettings,
        mealPlanService: MealPlanService,
        inventoryService: InventoryService,
        ingredientIndex: IngredientIndexService,
        indexer: RecipeIndexer,
        preSelectedRecipe?: Recipe,
        prePopulatedIngredients?: { quantity: number; unit: string; name: string; checked: boolean }[]
    ) {
        super(app);
        this.settings = settings;
        this.mealPlanService = mealPlanService;
        this.inventoryService = inventoryService;
        this.ingredientIndex = ingredientIndex;
        this.indexer = indexer;
        this.preSelectedRecipe = preSelectedRecipe || null;
        this.prePopulatedIngredients = prePopulatedIngredients;
    }

    async onOpen() {
        // If we have a pre-selected recipe, go straight to confirm
        if (this.preSelectedRecipe) {
            await this.selectRecipe(this.preSelectedRecipe.title, this.preSelectedRecipe.path);
            return;
        }

        await this.loadUpcomingMeals();
        this.render();
    }

    private async loadUpcomingMeals() {
        const allMeals = this.mealPlanService.getAllMeals();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        // Helper to get week number within the month (1-based)
        const getWeekOfMonth = (date: Date): number => {
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const firstDayOfWeek = firstDay.getDay(); // 0=Sun
            const dayOfMonth = date.getDate();
            return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
        };

        // Get next 3 days (today, tomorrow, day after)
        const upcoming: PlannedMeal[] = [];
        for (let i = 0; i < 3; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayName = dayNames[date.getDay()];
            const monthName = monthNames[date.getMonth()];
            const year = date.getFullYear();
            const weekNum = getWeekOfMonth(date);

            // Filter by day, month, year, AND week number
            const dayMeals = allMeals.filter(m =>
                m.day === dayName &&
                m.planMonth === monthName &&
                m.planYear === year &&
                m.weekNumber === weekNum
            );

            // Take all meals for this specific day
            for (const meal of dayMeals) {
                upcoming.push(meal);
            }
        }

        this.upcomingMeals = upcoming;
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-log-meal-modal');

        if (this.step === 'select') {
            this.renderSelectStep();
        } else {
            this.renderConfirmStep();
        }
    }

    private renderSelectStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: '🍽️ Log Meal' });

        contentEl.createEl('p', {
            text: 'Select a meal to log and deduct from inventory.',
            cls: 'mise-modal-description'
        });

        // Upcoming meals section (next 3 days)
        contentEl.createEl('h4', { text: 'Upcoming Meals' });

        if (this.upcomingMeals.length === 0) {
            contentEl.createEl('p', {
                text: 'No meals scheduled for upcoming days.',
                cls: 'mise-text-muted'
            });
        } else {
            const mealsList = contentEl.createDiv('mise-todays-meals');

            for (const meal of this.upcomingMeals) {
                const mealBtn = mealsList.createEl('button', {
                    cls: 'mise-meal-option'
                });
                mealBtn.style.display = 'block';
                mealBtn.style.width = '100%';
                mealBtn.style.textAlign = 'left';
                mealBtn.style.marginBottom = '8px';
                mealBtn.style.padding = '10px';

                const icon = meal.mealType === 'breakfast' ? '🍳' :
                    meal.mealType === 'lunch' ? '🥗' : '🍽️';
                mealBtn.textContent = `${icon} ${meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}: ${meal.recipeTitle}`;

                mealBtn.onclick = async () => {
                    this.selectedMealType = meal.mealType;
                    await this.selectRecipe(meal.recipeTitle, meal.recipePath);
                };
            }
        }

        // Choose from cookbook section
        contentEl.createEl('h4', { text: 'Or Choose from Cookbook' });

        const recipeDropdown = contentEl.createEl('select');
        recipeDropdown.style.width = '100%';
        recipeDropdown.style.marginBottom = '10px';

        const defaultOption = recipeDropdown.createEl('option', { text: '-- Select a recipe --' });
        defaultOption.value = '';

        const recipes = this.indexer.getRecipes();
        for (const recipe of recipes.sort((a, b) => a.title.localeCompare(b.title))) {
            const opt = recipeDropdown.createEl('option', { text: recipe.title });
            opt.value = recipe.path;
        }

        // Meal type selector for cookbook recipes
        new Setting(contentEl)
            .setName('Meal Type')
            .addDropdown(dropdown => {
                dropdown.addOption('breakfast', '🍳 Breakfast');
                dropdown.addOption('lunch', '🥗 Lunch');
                dropdown.addOption('dinner', '🍽️ Dinner');
                dropdown.setValue(this.selectedMealType);
                dropdown.onChange(value => {
                    this.selectedMealType = value as 'breakfast' | 'lunch' | 'dinner';
                });
            });

        const selectBtn = contentEl.createEl('button', {
            text: 'Select Recipe',
            cls: 'mod-cta'
        });
        selectBtn.onclick = async () => {
            const selectedPath = recipeDropdown.value;
            if (!selectedPath) {
                new Notice('Please select a recipe');
                return;
            }
            const recipe = this.indexer.getRecipe(selectedPath);
            if (recipe) {
                await this.selectRecipe(recipe.title, recipe.path);
            }
        };

        // Cancel button
        const cancelBtn = contentEl.createEl('button', { text: 'Cancel' });
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.onclick = () => this.close();
    }

    private async selectRecipe(title: string, path: string | null) {
        // Load recipe by path if available
        if (path) {
            this.selectedRecipe = this.indexer.getRecipe(path) || null;
        }

        // Fallback: try to find recipe by title if path didn't work
        if (!this.selectedRecipe) {
            const allRecipes = this.indexer.getRecipes();
            const matchByTitle = allRecipes.find(r =>
                r.title.toLowerCase() === title.toLowerCase() ||
                r.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(r.title.toLowerCase())
            );
            if (matchByTitle) {
                this.selectedRecipe = matchByTitle;
                path = matchByTitle.path;
            }
        }

        // Still no recipe? Try to load from file path directly
        if (!this.selectedRecipe && path) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file) {
                const content = await this.app.vault.read(file as any);
                const ingredientStrings = parseIngredients(content);
                this.selectedRecipe = {
                    title,
                    path,
                    ingredients: ingredientStrings,
                } as Recipe;
            }
        }

        if (!this.selectedRecipe) {
            new Notice(`Could not load recipe: ${title}`);
            return;
        }

        // If we have pre-populated ingredients from RecipeModal, use those
        if (this.prePopulatedIngredients && this.prePopulatedIngredients.length > 0) {
            this.ingredients = this.prePopulatedIngredients.map(ing => ({
                original: `${ing.quantity} ${ing.unit} ${ing.name}`,
                checked: ing.checked,
                quantity: ing.quantity,
                unit: ing.unit,
                name: ing.name,
            }));
        } else {
            // Parse ingredients from recipe
            this.ingredients = this.selectedRecipe.ingredients.map(ing => {
                const parsed = parseIngredient(ing);
                return {
                    original: ing,
                    checked: true,
                    quantity: parsed.value || 1,
                    unit: parsed.unit || '',
                    name: parsed.ingredient,
                };
            });
        }

        this.step = 'confirm';
        this.render();
    }

    private renderConfirmStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: `📝 Confirm: ${this.selectedRecipe?.title}` });

        contentEl.createEl('p', {
            text: 'Check the ingredients you used. Adjust quantities if needed.',
            cls: 'mise-modal-description'
        });

        // Ingredients list with checkboxes
        const ingContainer = contentEl.createDiv('mise-ingredients-confirm');

        for (const ing of this.ingredients) {
            const row = ingContainer.createDiv('mise-ingredient-row');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.marginBottom = '8px';
            row.style.padding = '6px';
            row.style.background = 'var(--background-secondary)';
            row.style.borderRadius = '4px';

            // Checkbox
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = ing.checked;
            checkbox.onchange = () => {
                ing.checked = checkbox.checked;
            };

            // Quantity input
            const qtyInput = row.createEl('input', { type: 'number' });
            qtyInput.value = String(ing.quantity);
            qtyInput.style.width = '60px';
            qtyInput.min = '0';
            qtyInput.step = '0.25';
            qtyInput.onchange = () => {
                ing.quantity = parseFloat(qtyInput.value) || 0;
            };

            // Unit dropdown (editable)
            const unitSelect = row.createEl('select');
            unitSelect.style.width = '70px';
            const commonUnits = ['', 'count', 'oz', 'lb', 'g', 'cup', 'cups', 'tbsp', 'tsp', 'ml', 'L', 'gal', 'qt', 'pint'];
            for (const u of commonUnits) {
                const opt = unitSelect.createEl('option', { text: u || '—' });
                opt.value = u;
            }
            unitSelect.value = ing.unit;
            unitSelect.onchange = () => {
                ing.unit = unitSelect.value;
            };

            // Ingredient name
            row.createEl('span', { text: ing.name });
        }

        // Custom ingredients section
        const customSection = contentEl.createDiv('mise-custom-ingredients');
        customSection.style.marginTop = '12px';
        customSection.style.paddingTop = '12px';
        customSection.style.borderTop = '1px solid var(--background-modifier-border)';

        // Render existing custom ingredients
        for (let i = 0; i < this.customIngredients.length; i++) {
            const custIng = this.customIngredients[i];
            const row = customSection.createDiv('mise-ingredient-row');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.marginBottom = '8px';
            row.style.padding = '6px';
            row.style.background = 'var(--background-secondary-alt)';
            row.style.borderRadius = '4px';

            // Checkbox (always checked for custom)
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = custIng.checked;
            checkbox.onchange = () => { custIng.checked = checkbox.checked; };

            // Quantity input
            const qtyInput = row.createEl('input', { type: 'number' });
            qtyInput.value = String(custIng.quantity);
            qtyInput.style.width = '60px';
            qtyInput.min = '0';
            qtyInput.step = '0.25';
            qtyInput.onchange = () => { custIng.quantity = parseFloat(qtyInput.value) || 0; };

            // Unit dropdown
            const unitSelect = row.createEl('select');
            unitSelect.style.width = '70px';
            const commonUnits = ['', 'oz', 'lb', 'g', 'cup', 'cups', 'tbsp', 'tsp', 'count'];
            for (const u of commonUnits) {
                const opt = unitSelect.createEl('option', { text: u || '—' });
                opt.value = u;
            }
            unitSelect.value = custIng.unit;
            unitSelect.onchange = () => { custIng.unit = unitSelect.value; };

            // Name input with datalist for autocomplete
            const nameInput = row.createEl('input', { type: 'text' });
            nameInput.value = custIng.name;
            nameInput.placeholder = 'Item name';
            nameInput.style.flex = '1';
            nameInput.id = `custom-ing-${i}`;
            nameInput.setAttribute('list', 'inventory-items-list');
            nameInput.oninput = () => { custIng.name = nameInput.value; };

            // Remove button
            const removeBtn = row.createEl('button', { text: '✕' });
            removeBtn.style.padding = '2px 8px';
            removeBtn.onclick = () => {
                this.customIngredients.splice(i, 1);
                this.render();
            };
        }

        // Datalist for autocomplete - use both inventory and indexed ingredients
        let datalist = contentEl.querySelector('#inventory-items-list') as HTMLDataListElement;
        if (!datalist) {
            datalist = contentEl.createEl('datalist');
            datalist.id = 'inventory-items-list';
            // Add inventory items
            const inventoryItems = this.inventoryService.getStock();
            const addedNames = new Set<string>();
            for (const item of inventoryItems) {
                datalist.createEl('option', { value: item.name });
                addedNames.add(item.name.toLowerCase());
            }
            // Add indexed ingredients not already in inventory
            const indexedIngredients = this.ingredientIndex.getAllIngredients();
            for (const ing of indexedIngredients) {
                if (!addedNames.has(ing.name.toLowerCase())) {
                    datalist.createEl('option', { value: ing.name });
                }
            }
        }

        // Add Item button
        const addBtn = customSection.createEl('button', { text: '+ Add Item' });
        addBtn.style.marginTop = '8px';
        addBtn.onclick = () => {
            this.customIngredients.push({
                original: '',
                checked: true,
                quantity: 1,
                unit: 'oz',
                name: '',
            });
            this.render();
        };

        // Buttons
        const buttonContainer = contentEl.createDiv('mise-modal-nav');
        buttonContainer.style.marginTop = '20px';

        const backBtn = buttonContainer.createEl('button', { text: '← Back' });
        backBtn.onclick = () => {
            this.step = 'select';
            this.render();
        };

        const logBtn = buttonContainer.createEl('button', {
            text: '✓ Log Meal & Deduct',
            cls: 'mod-cta'
        });
        logBtn.onclick = () => this.doLogMeal(logBtn);
    }

    private async doLogMeal(button: HTMLButtonElement) {
        // Combine recipe ingredients and custom ingredients
        const allIngredients = [...this.ingredients, ...this.customIngredients];
        const checkedIngredients = allIngredients.filter(i => i.checked && i.quantity > 0 && i.name.trim());

        if (checkedIngredients.length === 0) {
            new Notice('No ingredients selected');
            return;
        }

        button.textContent = 'Logging...';
        button.disabled = true;

        try {
            // 1. Deduct from inventory
            let deducted = 0;
            let notFound = 0;

            for (const ing of checkedIngredients) {
                const result = await this.inventoryService.deductStock(
                    ing.name,
                    ing.quantity,
                    ing.unit
                );
                if (result.found) {
                    deducted++;
                } else {
                    notFound++;
                }
            }

            // 2. Write to Meal Log
            await this.writeMealLog(checkedIngredients);

            // 3. Show results
            let message = `✅ Logged ${this.selectedRecipe?.title}`;
            if (deducted > 0) {
                message += ` (${deducted} items deducted)`;
            }
            if (notFound > 0) {
                message += ` ⚠️ ${notFound} not in inventory`;
            }

            new Notice(message);
            this.close();

        } catch (error: any) {
            console.error('LogMealModal: Error logging meal', error);
            new Notice(`❌ Error: ${error.message || 'Unknown error'}`);
            button.textContent = '✓ Log Meal & Deduct';
            button.disabled = false;
        }
    }

    private async writeMealLog(ingredients: IngredientSelection[]) {
        // Meal Log goes in parent of inventory folder (e.g., Life/Household/Kitchen)
        const inventoryFolder = this.settings.inventoryFolder;
        const parentFolder = inventoryFolder.substring(0, inventoryFolder.lastIndexOf('/')) || inventoryFolder;
        const logPath = `${parentFolder}/Meal Log.md`;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Build log entry
        let entry = `\n## ${dateStr} ${timeStr} - ${this.selectedMealType.charAt(0).toUpperCase() + this.selectedMealType.slice(1)}\n\n`;
        entry += `**Recipe:** ${this.selectedRecipe?.title}\n\n`;
        entry += `**Ingredients Used:**\n`;

        for (const ing of ingredients) {
            const qtyStr = ing.quantity % 1 === 0 ? String(ing.quantity) : ing.quantity.toFixed(2);
            entry += `- ${qtyStr} ${ing.unit} ${ing.name}\n`;
        }
        entry += `\n---\n`;

        // Get or create log file
        let existingContent = '';
        const file = this.app.vault.getAbstractFileByPath(logPath);

        if (file) {
            existingContent = await this.app.vault.read(file as any);
            await this.app.vault.modify(file as any, existingContent + entry);
        } else {
            // Create new file with header
            const header = `# Meal Log\n\n> [!NOTE]\n> Meals logged through Mise for calorie tracking. Delete entries after logging to your calorie app.\n\n---\n`;
            await this.app.vault.create(logPath, header + entry);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
