/**
 * Mise Plugin - Main Entry Point
 * 
 * This is a THIN orchestrator only. All business logic lives in services.
 * This file only:
 * - Initializes services
 * - Registers commands and views
 * - Wires dependencies together
 */

import { Plugin } from 'obsidian';
import { MiseSettings, DEFAULT_SETTINGS } from './types';
import { RecipeIndexer, MealPlanService, ShoppingListService } from './services';
import { MiseSettingsTab } from './ui/settings/MiseSettingsTab';
import { PLUGIN_NAME } from './utils/constants';

export default class MisePlugin extends Plugin {
    settings: MiseSettings;

    // Services
    indexer: RecipeIndexer;
    mealPlanService: MealPlanService;
    shoppingListService: ShoppingListService;

    async onload(): Promise<void> {
        console.log(`${PLUGIN_NAME}: Loading plugin...`);

        // Load settings
        await this.loadSettings();

        // Initialize services
        this.indexer = new RecipeIndexer(this.app, this.settings);
        this.mealPlanService = new MealPlanService(this.app, this.settings, this.indexer);
        this.shoppingListService = new ShoppingListService(this.app, this.settings, this.indexer);

        // Register settings tab
        this.addSettingTab(new MiseSettingsTab(this.app, this));

        // Register commands (placeholders for future phases)
        this.addCommand({
            id: 'open-cookbook',
            name: 'Open Cookbook',
            callback: () => {
                // TODO: Phase 5 - Open cookbook view
                console.log(`${PLUGIN_NAME}: Open Cookbook command (not yet implemented)`);
            }
        });

        this.addCommand({
            id: 'generate-shopping-list',
            name: 'Generate Shopping List',
            callback: () => {
                // TODO: Phase 13 - Generate shopping list
                console.log(`${PLUGIN_NAME}: Generate Shopping List command (not yet implemented)`);
            }
        });

        // TODO: Phase 5 - Add ribbon icon
        // this.addRibbonIcon('chef-hat', 'Open Mise Cookbook', () => {
        // 	this.activateCookbookView();
        // });

        // Wait for workspace layout to be ready before initializing indexer
        // This ensures the vault is fully loaded
        this.app.workspace.onLayoutReady(async () => {
            await this.indexer.initialize();
        });

        console.log(`${PLUGIN_NAME}: Plugin loaded.`);
    }

    async onunload(): Promise<void> {
        console.log(`${PLUGIN_NAME}: Unloading plugin...`);

        // Clean up services
        this.indexer?.destroy();

        console.log(`${PLUGIN_NAME}: Plugin unloaded.`);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
