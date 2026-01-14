/**
 * MealPlanService - Load and watch meal plan files
 * 
 * This service reads meal plan markdown files and provides
 * lookup methods to check which recipes are planned.
 */

import { App, TFile, EventRef, Events } from 'obsidian';
import { MiseSettings, PlannedMeal } from '../types';
import { parseMealPlan, ParsedMealPlan, getPlannedDaysForRecipe } from './MealPlanParser';

export class MealPlanService extends Events {
    private app: App;
    private settings: MiseSettings;
    private mealPlan: ParsedMealPlan | null = null;
    private fileWatcher: EventRef | null = null;
    private currentFilePath: string | null = null;

    constructor(app: App, settings: MiseSettings) {
        super();
        this.app = app;
        this.settings = settings;
    }

    /**
     * Initialize the service - load meal plan and set up watcher
     */
    async initialize(): Promise<void> {
        await this.loadMealPlan();
        this.setupWatcher();
    }

    /**
     * Clean up when plugin unloads
     */
    destroy(): void {
        if (this.fileWatcher) {
            this.app.vault.offref(this.fileWatcher);
            this.fileWatcher = null;
        }
    }

    /**
     * Load the meal plan file from settings folder
     * Looks for any .md file in the meal plan folder with 'meal' or 'plan' in name
     */
    private async loadMealPlan(): Promise<void> {
        const folder = this.settings.mealPlanFolder;
        console.log(`MealPlanService: Looking for meal plans in folder: "${folder}"`);

        if (!folder) {
            console.log('MealPlanService: No mealPlanFolder configured');
            this.mealPlan = null;
            return;
        }

        // Normalize folder path (remove trailing slash if present)
        const normalizedFolder = folder.replace(/\/$/, '');

        // Find meal plan files in the folder
        const allFiles = this.app.vault.getFiles();
        console.log(`MealPlanService: Total files in vault: ${allFiles.length}`);

        const files = allFiles.filter(f => {
            const inFolder = f.path.startsWith(normalizedFolder + '/') || f.path.startsWith(normalizedFolder + '\\');
            const isMd = f.extension === 'md';
            const hasMealOrPlan = f.name.toLowerCase().includes('meal') || f.name.toLowerCase().includes('plan');
            return inFolder && isMd && hasMealOrPlan;
        });

        console.log(`MealPlanService: Found ${files.length} meal plan files`);
        files.forEach(f => console.log(`  - ${f.path}`));

        if (files.length === 0) {
            console.log(`MealPlanService: No meal plan files found in ${folder}`);
            this.mealPlan = null;
            return;
        }

        // Use the most recently modified file
        const file = files.sort((a, b) => b.stat.mtime - a.stat.mtime)[0];
        this.currentFilePath = file.path;

        try {
            const content = await this.app.vault.read(file);
            this.mealPlan = parseMealPlan(content);
            console.log(`MealPlanService: Loaded ${this.mealPlan.meals.length} meals from ${file.path}`);
            if (this.mealPlan.meals.length > 0) {
                console.log(`MealPlanService: First few meals:`, this.mealPlan.meals.slice(0, 3));
            }
            this.trigger('meal-plan-updated');
        } catch (error) {
            console.error('MealPlanService: Error loading meal plan', error);
            this.mealPlan = null;
        }
    }

    /**
     * Watch for changes to meal plan files
     */
    private setupWatcher(): void {
        this.fileWatcher = this.app.vault.on('modify', async (file) => {
            if (file.path === this.currentFilePath) {
                await this.loadMealPlan();
            }
        });
    }

    /**
     * Check if the service is ready
     */
    isReady(): boolean {
        return this.mealPlan !== null;
    }

    /**
     * Get all planned meals
     */
    getAllMeals(): PlannedMeal[] {
        return this.mealPlan?.meals || [];
    }

    /**
     * Get planned days for a specific recipe by title
     * Returns array of PlannedMeal objects with day/mealType info
     */
    getPlannedDays(recipeTitle: string): PlannedMeal[] {
        if (!this.mealPlan) return [];
        return getPlannedDaysForRecipe(this.mealPlan.recipeMap, recipeTitle);
    }

    /**
     * Check if a recipe is planned for any day
     */
    isPlanned(recipeTitle: string): boolean {
        return this.getPlannedDays(recipeTitle).length > 0;
    }

    /**
     * Get a summary of planned days (e.g., "Mon, Wed, Fri")
     */
    getPlannedDaysSummary(recipeTitle: string): string {
        const meals = this.getPlannedDays(recipeTitle);
        if (meals.length === 0) return '';

        const days = [...new Set(meals.map(m => m.day))];
        return days.join(', ');
    }
}
