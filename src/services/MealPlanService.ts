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

    /**
     * Get the current meal plan file path
     */
    getCurrentFilePath(): string | null {
        return this.currentFilePath;
    }

    /**
     * Add a meal to the meal plan file
     */
    async addMeal(
        recipeTitle: string,
        recipePath: string | null,
        day: string,
        weekNumber: number,
        mealType: 'breakfast' | 'lunch' | 'dinner'
    ): Promise<boolean> {
        if (!this.currentFilePath) {
            console.error('MealPlanService: No meal plan file loaded');
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(this.currentFilePath);
        if (!file || !(file instanceof TFile)) {
            console.error('MealPlanService: Meal plan file not found');
            return false;
        }

        try {
            const content = await this.app.vault.read(file);
            const newContent = this.insertMealIntoContent(
                content, recipeTitle, recipePath, day, weekNumber, mealType
            );

            await this.app.vault.modify(file, newContent);
            console.log(`MealPlanService: Added ${recipeTitle} to ${day} ${mealType} Week ${weekNumber}`);
            return true;
        } catch (error) {
            console.error('MealPlanService: Error adding meal', error);
            return false;
        }
    }

    /**
     * Remove a meal from the meal plan file
     */
    async removeMeal(
        recipeTitle: string,
        day: string,
        weekNumber: number,
        mealType: 'breakfast' | 'lunch' | 'dinner'
    ): Promise<boolean> {
        if (!this.currentFilePath) {
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(this.currentFilePath);
        if (!file || !(file instanceof TFile)) {
            return false;
        }

        try {
            const content = await this.app.vault.read(file);
            const newContent = this.removeMealFromContent(
                content, recipeTitle, day, weekNumber, mealType
            );

            await this.app.vault.modify(file, newContent);
            console.log(`MealPlanService: Removed ${recipeTitle} from ${day} ${mealType} Week ${weekNumber}`);
            return true;
        } catch (error) {
            console.error('MealPlanService: Error removing meal', error);
            return false;
        }
    }

    /**
     * Insert a meal into the markdown content
     * Finds the correct week and meal type table and adds a row
     */
    private insertMealIntoContent(
        content: string,
        recipeTitle: string,
        recipePath: string | null,
        day: string,
        weekNumber: number,
        mealType: 'breakfast' | 'lunch' | 'dinner'
    ): string {
        const lines = content.split('\n');
        let currentWeek = 0;
        let currentMealType: string | null = null;
        let insertIndex = -1;

        // Find the correct location to insert
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for week header
            const weekMatch = line.match(/^##\s+Week\s+(\d+)/i);
            if (weekMatch) {
                currentWeek = parseInt(weekMatch[1], 10);
            }

            // Check for meal type header
            if (line.toLowerCase().includes('breakfast')) currentMealType = 'breakfast';
            else if (line.toLowerCase().includes('lunch')) currentMealType = 'lunch';
            else if (line.toLowerCase().includes('dinner')) currentMealType = 'dinner';

            // Check if we're in the right week and meal type
            if (currentWeek === weekNumber && currentMealType === mealType) {
                // Look for the end of the table (next section or blank line after table)
                if (line.startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('day')) {
                    insertIndex = i + 1; // Keep updating to find last row
                }
            }
        }

        // Create the new row
        const wikilink = recipePath ? `[[${recipeTitle}]]` : recipeTitle;
        const newRow = `| ${day} | ${wikilink} | - | - | - | |`;

        if (insertIndex > 0) {
            lines.splice(insertIndex, 0, newRow);
        } else {
            // Fallback: append to end of file
            console.warn('MealPlanService: Could not find correct table, appending to end');
            lines.push(newRow);
        }

        return lines.join('\n');
    }

    /**
     * Remove a meal from the markdown content
     */
    private removeMealFromContent(
        content: string,
        recipeTitle: string,
        day: string,
        weekNumber: number,
        mealType: 'breakfast' | 'lunch' | 'dinner'
    ): string {
        const lines = content.split('\n');
        let currentWeek = 0;
        let currentMealType: string | null = null;

        const result: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for week header
            const weekMatch = line.match(/^##\s+Week\s+(\d+)/i);
            if (weekMatch) {
                currentWeek = parseInt(weekMatch[1], 10);
            }

            // Check for meal type header
            if (line.toLowerCase().includes('breakfast')) currentMealType = 'breakfast';
            else if (line.toLowerCase().includes('lunch')) currentMealType = 'lunch';
            else if (line.toLowerCase().includes('dinner')) currentMealType = 'dinner';

            // Check if this is the row to remove
            if (currentWeek === weekNumber &&
                currentMealType === mealType &&
                line.startsWith('|') &&
                line.toLowerCase().includes(recipeTitle.toLowerCase()) &&
                line.includes(day)) {
                // Skip this line (remove it)
                console.log(`MealPlanService: Removing line: ${line}`);
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    }
}
