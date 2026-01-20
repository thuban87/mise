/**
 * AddRecipeModal - Modal for manually creating new recipe files
 * 
 * Creates recipe files with:
 * - Frontmatter (category, rating, servings, prep/cook time, source, image, dietary flags)
 * - Infobox with Dataview syntax
 * - Ingredients section with autocomplete from index
 * - Instructions as numbered list
 * - Notes section
 */

import { App, Modal, Setting, Notice, TFolder, TFile, TextComponent } from 'obsidian';
import { MiseSettings, RecipeCategory } from '../../types';
import { IngredientIndexService } from '../../services/IngredientIndexService';
import { IngredientSuggest } from './IngredientSuggest';

const CATEGORIES: RecipeCategory[] = ['Main', 'Side', 'Snack', 'Dessert', 'Breakfast', 'Beverage', 'Uncategorized'];

const COMMON_UNITS = [
    'count', 'oz', 'lb', 'g', 'kg',
    'cup', 'cups', 'tbsp', 'tsp',
    'ml', 'L', 'can', 'pkg', 'bunch'
];

interface IngredientRow {
    quantity: string;
    unit: string;
    name: string;
}

export class AddRecipeModal extends Modal {
    private settings: MiseSettings;
    private ingredientIndex: IngredientIndexService;
    private onSuccess?: () => void;

    // Form state
    private title: string = '';
    private folder: string = '';
    private category: RecipeCategory = 'Main';
    private rating: number = 0;
    private servings: number = 1;
    private prepTime: number = 0;
    private cookTime: number = 0;
    private source: string = 'Me';
    private image: string = '';
    private dietaryFlags: string = '';
    private ingredients: IngredientRow[] = [{ quantity: '', unit: 'oz', name: '' }];
    private instructions: string = '';
    private notes: string = '';

    // Available folders from recipes directory
    private availableFolders: string[] = [];

    constructor(
        app: App,
        settings: MiseSettings,
        ingredientIndex: IngredientIndexService,
        onSuccess?: () => void
    ) {
        super(app);
        this.settings = settings;
        this.ingredientIndex = ingredientIndex;
        this.onSuccess = onSuccess;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-add-recipe-modal');

        // Load available folders from recipes directory
        await this.loadAvailableFolders();

        this.render();
    }

    private async loadAvailableFolders() {
        const recipesFolder = this.app.vault.getAbstractFileByPath(this.settings.recipesFolder);
        if (recipesFolder instanceof TFolder) {
            this.availableFolders = this.getFoldersRecursive(recipesFolder)
                .map(f => f.path.replace(this.settings.recipesFolder + '/', ''))
                .filter(f => f.length > 0);
        }
        // Always include root option
        if (!this.availableFolders.includes('')) {
            this.availableFolders.unshift('');
        }
    }

    private getFoldersRecursive(folder: TFolder): TFolder[] {
        const folders: TFolder[] = [];
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                folders.push(child);
                folders.push(...this.getFoldersRecursive(child));
            }
        }
        return folders;
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '📝 New Recipe' });

        // === Title ===
        new Setting(contentEl)
            .setName('Title')
            .setDesc('Recipe name (becomes filename)')
            .addText(text => {
                text.setPlaceholder('e.g., BBQ Chicken Bowl')
                    .setValue(this.title)
                    .onChange(v => this.title = v.trim());
                text.inputEl.style.width = '100%';
            });

        // === Folder (from existing subfolders) ===
        new Setting(contentEl)
            .setName('Folder')
            .setDesc('Where to save this recipe')
            .addDropdown(dropdown => {
                dropdown.addOption('', '(Root)');
                for (const folder of this.availableFolders.filter(f => f)) {
                    dropdown.addOption(folder, folder);
                }
                dropdown.setValue(this.folder);
                dropdown.onChange(v => this.folder = v);
            });

        // === Category ===
        new Setting(contentEl)
            .setName('Category')
            .addDropdown(dropdown => {
                for (const cat of CATEGORIES) {
                    dropdown.addOption(cat, cat);
                }
                dropdown.setValue(this.category);
                dropdown.onChange(v => this.category = v as RecipeCategory);
            });

        // === Rating ===
        new Setting(contentEl)
            .setName('Rating')
            .addSlider(slider => {
                slider.setLimits(0, 5, 1)
                    .setValue(this.rating)
                    .setDynamicTooltip()
                    .onChange(v => this.rating = v);
            });

        // === Servings ===
        new Setting(contentEl)
            .setName('Servings')
            .addText(text => {
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.setValue(String(this.servings))
                    .onChange(v => this.servings = parseInt(v) || 1);
                text.inputEl.style.width = '60px';
            });

        // === Prep Time ===
        new Setting(contentEl)
            .setName('Prep Time (mins)')
            .addText(text => {
                text.inputEl.type = 'number';
                text.inputEl.min = '0';
                text.setValue(String(this.prepTime))
                    .onChange(v => this.prepTime = parseInt(v) || 0);
                text.inputEl.style.width = '60px';
            });

        // === Cook Time ===
        new Setting(contentEl)
            .setName('Cook Time (mins)')
            .addText(text => {
                text.inputEl.type = 'number';
                text.inputEl.min = '0';
                text.setValue(String(this.cookTime))
                    .onChange(v => this.cookTime = parseInt(v) || 0);
                text.inputEl.style.width = '60px';
            });

        // === Source ===
        new Setting(contentEl)
            .setName('Source')
            .addText(text => {
                text.setPlaceholder('URL or "Me"')
                    .setValue(this.source)
                    .onChange(v => this.source = v.trim());
            });

        // === Image ===
        new Setting(contentEl)
            .setName('Image')
            .setDesc('Optional image URL or vault path')
            .addText(text => {
                text.setPlaceholder('https://... or path/to/image.jpg')
                    .setValue(this.image)
                    .onChange(v => this.image = v.trim());
                text.inputEl.style.width = '100%';
            });

        // === Dietary Flags ===
        new Setting(contentEl)
            .setName('Dietary Flags')
            .setDesc('Comma-separated (e.g., high-protein, vegetarian)')
            .addText(text => {
                text.setPlaceholder('high-protein, low-carb')
                    .setValue(this.dietaryFlags)
                    .onChange(v => this.dietaryFlags = v);
                text.inputEl.style.width = '100%';
            });

        // === Ingredients Section ===
        contentEl.createEl('h3', { text: '🥘 Ingredients' });
        const ingredientsContainer = contentEl.createDiv('mise-ingredients-container');
        this.renderIngredients(ingredientsContainer);

        // === Instructions Section ===
        contentEl.createEl('h3', { text: '🍳 Instructions' });
        new Setting(contentEl)
            .setDesc('One step per line (will be auto-numbered)')
            .addTextArea(textArea => {
                textArea.setPlaceholder('Preheat oven to 350°F\nMix ingredients...')
                    .setValue(this.instructions)
                    .onChange(v => this.instructions = v);
                textArea.inputEl.style.width = '100%';
                textArea.inputEl.style.height = '120px';
            });

        // === Notes Section ===
        contentEl.createEl('h3', { text: '📝 Notes' });
        new Setting(contentEl)
            .addTextArea(textArea => {
                textArea.setPlaceholder('Optional notes, tips, variations...')
                    .setValue(this.notes)
                    .onChange(v => this.notes = v);
                textArea.inputEl.style.width = '100%';
                textArea.inputEl.style.height = '60px';
            });

        // === Action Buttons ===
        const btnContainer = contentEl.createDiv('mise-modal-actions');

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = btnContainer.createEl('button', { text: '💾 Create Recipe', cls: 'mod-cta' });
        saveBtn.onclick = () => this.saveRecipe();
    }

    private renderIngredients(container: HTMLElement) {
        container.empty();

        this.ingredients.forEach((ing, index) => {
            const row = container.createDiv('mise-ingredient-input-row');

            // Quantity
            const qtyInput = row.createEl('input', { type: 'text' });
            qtyInput.value = ing.quantity;
            qtyInput.placeholder = 'Qty';
            qtyInput.style.width = '50px';
            qtyInput.onchange = () => { ing.quantity = qtyInput.value; };

            // Unit dropdown
            const unitSelect = row.createEl('select');
            for (const unit of COMMON_UNITS) {
                const opt = unitSelect.createEl('option', { text: unit, value: unit });
                if (unit === ing.unit) opt.selected = true;
            }
            unitSelect.onchange = () => { ing.unit = unitSelect.value; };

            // Name with autocomplete
            const nameInput = row.createEl('input', { type: 'text' });
            nameInput.value = ing.name;
            nameInput.placeholder = 'Ingredient name...';
            nameInput.style.flex = '1';
            nameInput.onchange = () => { ing.name = nameInput.value; };

            // Add autocomplete
            new IngredientSuggest(this.app, nameInput, this.ingredientIndex, (ingredient) => {
                ing.name = ingredient.name;
                nameInput.value = ingredient.name;
            });

            // Remove button
            const removeBtn = row.createEl('button', { text: '×', cls: 'mise-btn-icon' });
            removeBtn.onclick = () => {
                if (this.ingredients.length > 1) {
                    this.ingredients.splice(index, 1);
                    this.renderIngredients(container);
                }
            };
        });

        // Add ingredient button
        const addBtn = container.createEl('button', { text: '+ Add Ingredient', cls: 'mise-btn mise-btn-small' });
        addBtn.style.marginTop = '8px';
        addBtn.onclick = () => {
            this.ingredients.push({ quantity: '', unit: 'oz', name: '' });
            this.renderIngredients(container);
        };
    }

    private async saveRecipe() {
        // Validate
        if (!this.title.trim()) {
            new Notice('Please enter a recipe title');
            return;
        }

        // Build file path
        const fileName = this.title.replace(/[\\/:*?"<>|]/g, '').trim();
        const folderPath = this.folder
            ? `${this.settings.recipesFolder}/${this.folder}`
            : this.settings.recipesFolder;
        const filePath = `${folderPath}/${fileName}.md`;

        // Check if file exists
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            new Notice(`Recipe "${this.title}" already exists in that folder`);
            return;
        }

        // Ensure folder exists
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }

        // Generate markdown content
        const content = this.generateMarkdown();

        // Create file
        try {
            await this.app.vault.create(filePath, content);
            new Notice(`✅ Recipe "${this.title}" created!`);
            this.onSuccess?.();
            this.close();
        } catch (e) {
            console.error('Failed to create recipe:', e);
            new Notice(`Failed to create recipe: ${e}`);
        }
    }

    private generateMarkdown(): string {
        // Parse dietary flags
        const flags = this.dietaryFlags
            .split(',')
            .map(f => f.trim())
            .filter(f => f.length > 0);

        // Build frontmatter
        const frontmatter = [
            '---',
            `category: ${this.category}`,
            `rating: ${this.rating}`,
            `servings: ${this.servings}`,
            `prep_time: "${this.prepTime}"`,
            `cook_time: "${this.cookTime}"`,
            `source: ${this.source}`,
            `image: ${this.image}`,
        ];

        if (flags.length > 0) {
            frontmatter.push('dietaryFlags:');
            flags.forEach(f => frontmatter.push(`  - ${f}`));
        } else {
            frontmatter.push('dietaryFlags:');
        }

        frontmatter.push('---');

        // Build ingredients list
        const ingredientLines = this.ingredients
            .filter(ing => ing.name.trim())
            .map(ing => {
                const qty = ing.quantity || '';
                const unit = ing.unit !== 'count' ? ing.unit : '';
                return `- [ ] ${qty} ${unit} ${ing.name}`.replace(/\s+/g, ' ').trim();
            });

        // Build instructions (numbered)
        const instructionLines = this.instructions
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .map((line, i) => `${i + 1}. ${line}`);

        // Build notes
        const noteLines = this.notes
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .map(l => `- ${l}`);

        // Combine all
        return [
            ...frontmatter,
            '',
            `# ${this.title}`,
            '',
            '> [!infobox]',
            '> | | |',
            '> |---|---|',
            '> | **Prep Time** | `=this.prep_time` |',
            '> | **Cook Time** | `=this.cook_time` |',
            '> | **Servings** | `=this.servings` |',
            '> | **Rating** | `=this.rating`/5 |',
            '',
            '## 🥘 Ingredients',
            ...ingredientLines,
            '',
            '## 🍳 Instructions',
            ...instructionLines,
            '',
            '## 📝 Notes',
            noteLines.length > 0 ? noteLines.join('\n') : '- ',
        ].join('\n');
    }

    onClose() {
        this.contentEl.empty();
    }
}
