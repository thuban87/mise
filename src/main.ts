/**
 * Mise Plugin - Main Entry Point
 * 
 * This is a THIN orchestrator only. All business logic lives in services.
 * This file only:
 * - Initializes services
 * - Registers commands and views
 * - Wires dependencies together
 */

import { Plugin, WorkspaceLeaf, Notice, TFile, Menu } from 'obsidian';
import { MiseSettings, DEFAULT_SETTINGS } from './types';
import { RecipeIndexer, MealPlanService, ShoppingListService, TimeMigrationService, ImporterService } from './services';
import { RecipeScalingService } from './services/RecipeScalingService';
import { InventoryService } from './services/InventoryService';
import { MiseSettingsTab } from './ui/settings/MiseSettingsTab';
import { CookbookView, CookbookSidebar, MealPlanView, MISE_MEAL_PLAN_VIEW_TYPE } from './ui/views';
import { PLUGIN_NAME, MISE_COOKBOOK_VIEW_TYPE, MISE_SIDEBAR_VIEW_TYPE } from './utils/constants';
import { ShoppingListModal } from './ui/components/ShoppingListModal';
import { RecipeImportModal } from './ui/components/RecipeImportModal';
import { ScaleRecipeModal } from './ui/components/ScaleRecipeModal';
import { AddInventoryModal } from './ui/components/AddInventoryModal';
import { PantryCheckModal } from './ui/components/PantryCheckModal';
import { LogMealModal } from './ui/components/LogMealModal';

export default class MisePlugin extends Plugin {
    settings: MiseSettings;

    // Services
    indexer: RecipeIndexer;
    mealPlanService: MealPlanService;
    shoppingListService: ShoppingListService;
    timeMigration: TimeMigrationService;
    importerService: ImporterService;
    scalingService: RecipeScalingService;
    inventoryService: InventoryService;

    async onload(): Promise<void> {
        console.log(`${PLUGIN_NAME}: Loading plugin...`);

        // Load settings
        await this.loadSettings();

        // Initialize services
        this.indexer = new RecipeIndexer(this.app, this.settings);
        this.mealPlanService = new MealPlanService(this.app, this.settings);
        this.shoppingListService = new ShoppingListService(this.app, this.settings, this.indexer);
        this.timeMigration = new TimeMigrationService(this.app, this.settings);
        this.importerService = new ImporterService(this.app, this.settings);
        this.scalingService = new RecipeScalingService(this.app, this.settings, this.indexer);
        this.inventoryService = new InventoryService(this.app, this.settings);

        // Wire up service dependencies
        this.shoppingListService.setMealPlanService(this.mealPlanService);

        // Initialize indexer immediately
        this.indexer.initialize();

        // Initialize meal plan and inventory after layout is ready (vault files are loaded)
        this.app.workspace.onLayoutReady(() => {
            this.mealPlanService.initialize();
            this.inventoryService.initialize();
        });

        // Register views
        this.registerView(
            MISE_COOKBOOK_VIEW_TYPE,
            (leaf) => new CookbookView(leaf, this)
        );
        this.registerView(
            MISE_SIDEBAR_VIEW_TYPE,
            (leaf) => new CookbookSidebar(leaf, this)
        );
        this.registerView(
            MISE_MEAL_PLAN_VIEW_TYPE,
            (leaf) => new MealPlanView(leaf, this)
        );

        // Register settings tab
        this.addSettingTab(new MiseSettingsTab(this.app, this));

        // Register commands
        this.addCommand({
            id: 'open-cookbook',
            name: 'Open Cookbook',
            callback: () => {
                this.activateCookbookView();
            }
        });

        this.addCommand({
            id: 'open-cookbook-sidebar',
            name: 'Open Cookbook Sidebar',
            callback: () => {
                this.activateCookbookSidebar();
            }
        });

        this.addCommand({
            id: 'open-meal-plan',
            name: 'Open Meal Plan Calendar',
            callback: () => {
                this.activateMealPlanView();
            }
        });

        this.addCommand({
            id: 'import-recipe-from-url',
            name: 'Import Recipe from URL',
            callback: () => {
                const modal = new RecipeImportModal(
                    this.app,
                    this.importerService,
                    async (filePath) => {
                        // Open the created file
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file) {
                            await this.app.workspace.getLeaf('tab').openFile(file as any);
                        }
                    }
                );
                modal.open();
            }
        });

        this.addCommand({
            id: 'generate-shopping-list',
            name: 'Generate Shopping List',
            callback: async () => {
                // Get weeks info from meal plan
                const weeks = await this.mealPlanService.getWeeksInfo();

                // Get all items (for the entire month as baseline)
                const monthList = await this.shoppingListService.generateListForMonth();
                const allItems = monthList.aisles.flatMap(aisle => aisle.items);

                // Show the modal
                const modal = new ShoppingListModal(
                    this.app,
                    this.settings,
                    weeks,
                    allItems,
                    async (result) => {
                        console.log(`${PLUGIN_NAME}: Generating shopping list with:`, result);

                        // Handle Quick Trip (placeholder - Phase 16 will implement)
                        if (result.quickTrip) {
                            new Notice('Quick Trip requires Inventory System (Phase 16)');
                            return;
                        }

                        // Generate based on time range
                        let list;
                        if (result.timeRange.type === 'month') {
                            list = await this.shoppingListService.generateListForMonth(undefined, undefined, result.storeId || undefined);
                        } else {
                            list = await this.shoppingListService.generateListForWeek(result.timeRange.weekNumber, undefined, undefined, result.storeId || undefined);
                        }

                        // Filter by categories if bulk buy mode
                        if (result.bulkBuyMode && result.selectedCategories) {
                            list = this.shoppingListService.filterByCategories(list, result.selectedCategories);
                        }

                        // Filter items if user selected specific ones
                        if (result.selectedItems) {
                            const selectedSet = new Set(result.selectedItems.map(i => i.ingredient));
                            for (const aisle of list.aisles) {
                                aisle.items = aisle.items.filter(item => selectedSet.has(item.ingredient));
                            }
                            // Remove empty aisles
                            list.aisles = list.aisles.filter(a => a.items.length > 0);
                        }

                        // Write to file
                        const filePath = await this.shoppingListService.writeListToFile(list, result.dateRangeLabel);

                        // Show success and open file
                        new Notice(`✅ Shopping list created!`);
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file) {
                            await this.app.workspace.getLeaf('tab').openFile(file as any);
                        }
                    }
                );
                modal.open();
            }
        });

        this.addCommand({
            id: 'migrate-time-formats',
            name: 'Migrate Recipe Time Formats',
            callback: async () => {
                await this.timeMigration.migrateAll();
                // Re-index after migration
                await this.indexer.initialize();
            }
        });

        this.addCommand({
            id: 'preview-time-migration',
            name: 'Preview Time Format Migration',
            callback: async () => {
                const previews = await this.timeMigration.previewMigration();
                if (previews.length === 0) {
                    console.log(`${PLUGIN_NAME}: No time migrations needed - all recipes already use integer format`);
                } else {
                    console.log(`${PLUGIN_NAME}: Time migration preview (${previews.length} files would be changed):`);
                    for (const p of previews) {
                        console.log(`  ${p.file}:`);
                        for (const c of p.changes) {
                            console.log(`    ${c}`);
                        }
                    }
                }
            }
        });

        this.addCommand({
            id: 'export-recipe-index',
            name: 'Export Recipe Index to JSON',
            callback: async () => {
                await this.indexer.exportToJson();
                console.log(`${PLUGIN_NAME}: Recipe index exported to System/Mise/recipe-index.json`);
            }
        });

        // Meal plan generator command
        this.addCommand({
            id: 'generate-meal-plans',
            name: 'Generate Meal Plan Files',
            callback: async () => {
                await this.generateMealPlanFiles();
            }
        });

        // Inventory commands
        this.addCommand({
            id: 'add-inventory-item',
            name: 'Add Inventory Item',
            callback: () => {
                new AddInventoryModal(
                    this.app,
                    this.settings,
                    this.inventoryService,
                    () => {
                        // Refresh callback - could update any open inventory views
                    }
                ).open();
            }
        });

        this.addCommand({
            id: 'pantry-check',
            name: 'Pantry Check (Bulk Edit Inventory)',
            callback: () => {
                new PantryCheckModal(
                    this.app,
                    this.settings,
                    this.inventoryService
                ).open();
            }
        });

        this.addCommand({
            id: 'log-meal',
            name: 'Log Meal & Deduct Ingredients',
            callback: () => {
                new LogMealModal(
                    this.app,
                    this.settings,
                    this.mealPlanService,
                    this.inventoryService,
                    this.indexer
                ).open();
            }
        });

        // Add ribbon icon
        this.addRibbonIcon('book-open', 'Open Mise Cookbook', () => {
            this.activateCookbookView();
        });

        // Register file-menu event for recipe scaling
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file) => {
                if (file instanceof TFile && this.isRecipeFile(file)) {
                    menu.addItem((item) => {
                        item.setTitle('⚖️ Scale Recipe...')
                            .setIcon('scale')
                            .onClick(() => this.openScaleModal(file));
                    });
                }
            })
        );

        // Wait for workspace layout to be ready before initializing indexer
        // This ensures the vault is fully loaded
        this.app.workspace.onLayoutReady(async () => {
            await this.indexer.initialize();
            // Check for old shopping lists to archive
            await this.shoppingListService.checkAndPromptArchive();
        });

        console.log(`${PLUGIN_NAME}: Plugin loaded.`);
    }

    async onunload(): Promise<void> {
        console.log(`${PLUGIN_NAME}: Unloading plugin...`);

        // Clean up services
        this.indexer?.destroy();

        // Detach all views
        this.app.workspace.detachLeavesOfType(MISE_COOKBOOK_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(MISE_SIDEBAR_VIEW_TYPE);

        console.log(`${PLUGIN_NAME}: Plugin unloaded.`);
    }

    /**
     * Activate the main cookbook view in a new tab
     */
    async activateCookbookView(): Promise<void> {
        const { workspace } = this.app;

        // Check if view is already open
        let leaf = workspace.getLeavesOfType(MISE_COOKBOOK_VIEW_TYPE)[0];

        if (!leaf) {
            // Create new leaf in main area
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: MISE_COOKBOOK_VIEW_TYPE,
                active: true,
            });
        }

        // Reveal and focus the leaf
        workspace.revealLeaf(leaf);
    }

    /**
     * Activate the cookbook sidebar in the right panel
     */
    async activateCookbookSidebar(): Promise<void> {
        const { workspace } = this.app;

        // Check if sidebar is already open
        let leaf = workspace.getLeavesOfType(MISE_SIDEBAR_VIEW_TYPE)[0];

        if (!leaf) {
            // Create new leaf in right sidebar
            leaf = workspace.getRightLeaf(false)!;
            await leaf.setViewState({
                type: MISE_SIDEBAR_VIEW_TYPE,
                active: true,
            });
        }

        // Reveal and focus the leaf
        workspace.revealLeaf(leaf);
    }

    /**
     * Activate the meal plan calendar view in the main panel
     */
    async activateMealPlanView(): Promise<void> {
        const { workspace } = this.app;

        // Check if already open
        let leaf = workspace.getLeavesOfType(MISE_MEAL_PLAN_VIEW_TYPE)[0];

        if (!leaf) {
            // Create new tab
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: MISE_MEAL_PLAN_VIEW_TYPE,
                active: true,
            });
        }

        // Reveal and focus
        workspace.revealLeaf(leaf);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /**
     * Check if a file is in the recipes folder
     */
    private isRecipeFile(file: TFile): boolean {
        const recipesFolder = this.settings.recipesFolder;
        return file.extension === 'md' && file.path.startsWith(recipesFolder);
    }

    /**
     * Open the scale recipe modal for a file
     */
    private openScaleModal(file: TFile): void {
        const recipe = this.indexer.getRecipe(file.path);
        if (!recipe) {
            new Notice('Recipe not found in index. Try reloading the plugin.');
            return;
        }
        new ScaleRecipeModal(this.app, recipe, this.scalingService).open();
    }

    /**
     * Generate meal plan files for upcoming months
     * Creates markdown files with week tables for each month
     */
    private async generateMealPlanFiles(): Promise<void> {
        const folder = this.settings.mealPlanFolder;
        if (!folder) {
            new Notice('Please configure a meal plan folder in settings first.');
            return;
        }

        const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // TESTING MODE: Only create March and April 2026
        // After verifying format, change TEST_MODE to false to generate all 5 years
        const TEST_MODE = false;
        const startYear = 2026;
        const endYear = TEST_MODE ? 2026 : 2030;
        let filesCreated = 0;

        for (let year = startYear; year <= endYear; year++) {
            // Ensure year subfolder exists
            const yearFolder = `${folder}/${year}`;
            const yearFolderExists = this.app.vault.getAbstractFileByPath(yearFolder);
            if (!yearFolderExists) {
                try {
                    await this.app.vault.createFolder(yearFolder);
                    console.log(`Mise: Created folder ${yearFolder}`);
                } catch (e) {
                    // Folder might already exist
                }
            }

            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                // Skip Jan and Feb 2026 since they already exist
                if (year === 2026 && monthIndex < 2) continue;

                // In TEST_MODE, only create March and April 2026
                if (TEST_MODE && (year !== 2026 || monthIndex > 3)) continue;

                const monthName = MONTHS[monthIndex];
                // Put file in year subfolder: /2026/March 2026.md
                const fileName = `${yearFolder}/${monthName} ${year}.md`;

                // Check if file already exists
                const existingFile = this.app.vault.getAbstractFileByPath(fileName);
                if (existingFile) {
                    console.log(`Mise: Skipping ${fileName} - already exists`);
                    continue;
                }

                // Calculate weeks for this month using JavaScript Date
                // Date math is reliable - we calculate first day of month, 
                // number of days in month, and how many weeks it spans
                const content = this.generateMonthContent(year, monthIndex, monthName, DAYS);

                try {
                    await this.app.vault.create(fileName, content);
                    filesCreated++;
                    console.log(`Mise: Created ${fileName}`);
                } catch (error) {
                    console.error(`Mise: Error creating ${fileName}:`, error);
                }
            }
        }

        new Notice(`Created ${filesCreated} meal plan files. Check ${folder}/${startYear}/ to verify format.`);
    }

    /**
     * Generate markdown content for a month
     */
    private generateMonthContent(year: number, monthIndex: number, monthName: string, days: string[]): string {
        const lines: string[] = [];

        // Frontmatter
        lines.push('---');
        lines.push(`month: ${monthName}`);
        lines.push(`year: ${year}`);
        lines.push('---');
        lines.push('');
        lines.push(`# ${monthName} ${year} Meal Plan`);
        lines.push('');

        // Calculate weeks in this month
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const totalDays = lastDay.getDate();

        // Calculate how many weeks this month spans
        const firstDayWeekday = firstDay.getDay();
        const numWeeks = Math.ceil((totalDays + firstDayWeekday) / 7);

        // Generate each week
        for (let week = 1; week <= numWeeks; week++) {
            // Calculate date range for this week
            const weekStartDay = (week - 1) * 7 - firstDayWeekday + 1;
            const weekEndDay = weekStartDay + 6;
            const actualStart = Math.max(1, weekStartDay);
            const actualEnd = Math.min(totalDays, weekEndDay);

            lines.push(`## Week ${week} (${monthName} ${actualStart}-${actualEnd})`);
            lines.push('');

            // Generate each meal type
            for (const mealType of ['Breakfast', 'Lunch', 'Dinner']) {
                lines.push(`### ${mealType}`);
                lines.push('');
                lines.push('| Day | Meal | Protein | Side 1 | Side 2 | Notes |');
                lines.push('| --- | ---- | ------- | ------ | ------ | ----- |');

                // Add a row for each day of the week
                for (const day of days) {
                    lines.push(`| ${day} | | | | | |`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }
}
