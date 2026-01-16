/**
 * Mise Plugin - Main Entry Point
 * 
 * This is a THIN orchestrator only. All business logic lives in services.
 * This file only:
 * - Initializes services
 * - Registers commands and views
 * - Wires dependencies together
 */

import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { MiseSettings, DEFAULT_SETTINGS } from './types';
import { RecipeIndexer, MealPlanService, ShoppingListService, TimeMigrationService } from './services';
import { MiseSettingsTab } from './ui/settings/MiseSettingsTab';
import { CookbookView, CookbookSidebar, MealPlanView, MISE_MEAL_PLAN_VIEW_TYPE } from './ui/views';
import { PLUGIN_NAME, MISE_COOKBOOK_VIEW_TYPE, MISE_SIDEBAR_VIEW_TYPE } from './utils/constants';
import { ShoppingListModal } from './ui/components/ShoppingListModal';

export default class MisePlugin extends Plugin {
    settings: MiseSettings;

    // Services
    indexer: RecipeIndexer;
    mealPlanService: MealPlanService;
    shoppingListService: ShoppingListService;
    timeMigration: TimeMigrationService;

    async onload(): Promise<void> {
        console.log(`${PLUGIN_NAME}: Loading plugin...`);

        // Load settings
        await this.loadSettings();

        // Initialize services
        this.indexer = new RecipeIndexer(this.app, this.settings);
        this.mealPlanService = new MealPlanService(this.app, this.settings);
        this.shoppingListService = new ShoppingListService(this.app, this.settings, this.indexer);
        this.timeMigration = new TimeMigrationService(this.app, this.settings);

        // Wire up service dependencies
        this.shoppingListService.setMealPlanService(this.mealPlanService);

        // Initialize indexer immediately
        this.indexer.initialize();

        // Initialize meal plan after layout is ready (vault files are loaded)
        this.app.workspace.onLayoutReady(() => {
            this.mealPlanService.initialize();
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

        // Add ribbon icon
        this.addRibbonIcon('book-open', 'Open Mise Cookbook', () => {
            this.activateCookbookView();
        });

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
}
