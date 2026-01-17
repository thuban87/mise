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
            // Check if file is inside the meal plan folder OR any subfolder
            const inFolderOrSubfolder = f.path.startsWith(normalizedFolder + '/') || f.path.startsWith(normalizedFolder + '\\');
            const isMd = f.extension === 'md';
            // Check for month names or 'meal'/'plan' keywords
            const hasMonthName = /january|february|march|april|may|june|july|august|september|october|november|december/i.test(f.name);
            const hasMealOrPlan = f.name.toLowerCase().includes('meal') || f.name.toLowerCase().includes('plan');
            return inFolderOrSubfolder && isMd && (hasMonthName || hasMealOrPlan);
        });

        console.log(`MealPlanService: Found ${files.length} meal plan files`);
        files.forEach(f => console.log(`  - ${f.path}`));

        if (files.length === 0) {
            console.log(`MealPlanService: No meal plan files found in ${folder}`);
            this.mealPlan = null;
            return;
        }

        // Load ALL meal plan files and aggregate meals
        const allMeals: import('../types').PlannedMeal[] = [];

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const parsed = parseMealPlan(content);
                allMeals.push(...parsed.meals);
                console.log(`MealPlanService: Loaded ${parsed.meals.length} meals from ${file.name}`);
            } catch (error) {
                console.error(`MealPlanService: Error loading ${file.path}:`, error);
            }
        }

        // Store aggregated meals - use most recent file as "current" for writing new meals
        const mostRecentFile = files.sort((a, b) => b.stat.mtime - a.stat.mtime)[0];
        this.currentFilePath = mostRecentFile.path;

        this.mealPlan = { meals: allMeals, month: 'aggregated', recipeMap: new Map() };
        console.log(`MealPlanService: Total ${allMeals.length} meals aggregated from ${files.length} files`);
        if (allMeals.length > 0) {
            console.log(`MealPlanService: First few meals:`, allMeals.slice(0, 3));
        }
        this.trigger('meal-plan-updated');
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
     * Get info about available weeks (with date ranges if available in the file)
     */
    async getWeeksInfo(): Promise<{ weekNumber: number; startDate: string; endDate: string }[]> {
        if (!this.currentFilePath) return [];

        const file = this.app.vault.getAbstractFileByPath(this.currentFilePath);
        if (!(file instanceof Object)) return [];

        try {
            const content = await this.app.vault.read(file as any);
            const weeks: { weekNumber: number; startDate: string; endDate: string }[] = [];

            // Parse week headers: ## Week 1 (Jan 6-12) or ## Week 1 (January 6-12)
            const weekRegex = /^##\s+Week\s+(\d+)\s*\(?([^)]*)\)?/gmi;
            let match;

            while ((match = weekRegex.exec(content)) !== null) {
                const weekNum = parseInt(match[1], 10);
                const dateRange = match[2]?.trim() || '';

                // Try to parse date range like "Jan 6-12" or "January 6 - January 12"
                let startDate = '';
                let endDate = '';

                if (dateRange) {
                    const rangeMatch = dateRange.match(/([A-Za-z]+)\s*(\d+)\s*[-–]\s*(?:([A-Za-z]+)\s*)?(\d+)/);
                    if (rangeMatch) {
                        const startMonth = rangeMatch[1];
                        const startDay = rangeMatch[2];
                        const endMonth = rangeMatch[3] || startMonth;
                        const endDay = rangeMatch[4];
                        startDate = `${startMonth} ${startDay}`;
                        endDate = `${endMonth} ${endDay}`;
                    }
                }

                weeks.push({ weekNumber: weekNum, startDate, endDate });
            }

            // If no weeks found with dates, create defaults based on unique week numbers from meals
            if (weeks.length === 0) {
                const weekNumbers = [...new Set(this.getAllMeals().map(m => m.weekNumber))].sort();
                for (const num of weekNumbers) {
                    weeks.push({ weekNumber: num, startDate: '', endDate: '' });
                }
            }

            return weeks;
        } catch (error) {
            console.error('MealPlanService: Error getting weeks info', error);
            return [];
        }
    }


    /**
     * Add a meal to the meal plan file
     * @param month - Optional month name (e.g., "January", "February")
     * @param year - Optional year (e.g., 2026)
     */
    async addMeal(
        recipeTitle: string,
        recipePath: string | null,
        day: string,
        weekNumber: number,
        mealType: 'breakfast' | 'lunch' | 'dinner',
        month?: string,
        year?: number
    ): Promise<boolean> {
        // Find the correct file to modify
        let targetFilePath = this.currentFilePath;

        // If month is specified, find the file for that month
        if (month && year) {
            const monthFile = await this.findMealPlanFileForMonth(month, year);
            if (monthFile) {
                targetFilePath = monthFile;
            } else {
                console.warn(`MealPlanService: No meal plan file found for ${month} ${year}, using current file`);
            }
        }

        if (!targetFilePath) {
            console.error('MealPlanService: No meal plan file loaded');
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(targetFilePath);
        if (!file || !(file instanceof TFile)) {
            console.error('MealPlanService: Meal plan file not found:', targetFilePath);
            return false;
        }

        try {
            const content = await this.app.vault.read(file);
            const newContent = this.insertMealIntoContent(
                content, recipeTitle, recipePath, day, weekNumber, mealType
            );

            await this.app.vault.modify(file, newContent);
            console.log(`MealPlanService: Added ${recipeTitle} to ${day} ${mealType} Week ${weekNumber} in ${file.name}`);
            return true;
        } catch (error) {
            console.error('MealPlanService: Error adding meal', error);
            return false;
        }
    }

    /**
     * Find the meal plan file for a specific month and year
     * Searches in subfolders like /2026/, /2027/ etc.
     */
    private async findMealPlanFileForMonth(month: string, year: number): Promise<string | null> {
        const folder = this.settings.mealPlanFolder;
        if (!folder) return null;

        const normalizedFolder = folder.replace(/\/$/, '');
        const allFiles = this.app.vault.getFiles();

        // Look for files that contain the month name in folder OR subfolders
        const monthFiles = allFiles.filter(f => {
            const inFolderOrSubfolder = f.path.startsWith(normalizedFolder + '/') || f.path.startsWith(normalizedFolder + '\\');
            const isMd = f.extension === 'md';
            const hasMonth = f.name.toLowerCase().includes(month.toLowerCase());
            return inFolderOrSubfolder && isMd && hasMonth;
        });

        if (monthFiles.length > 0) {
            // Prefer file with year in name or path
            const withYear = monthFiles.find(f =>
                f.name.includes(year.toString()) || f.path.includes(`/${year}/`) || f.path.includes(`\\${year}\\`)
            );
            return withYear?.path || monthFiles[0].path;
        }

        return null;
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
     * Finds the correct week and meal type table and either:
     * 1. Updates an existing empty row for that day, OR
     * 2. Adds a new row at the end of the table
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
        let inTargetTable = false;
        let emptyRowIndex = -1;  // Index of empty row for this day
        let tableEndIndex = -1;  // Index to insert new row if needed

        // Create the wikilink
        const wikilink = recipePath ? `[[${recipeTitle}]]` : recipeTitle;

        // Find the correct location
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for week header
            const weekMatch = line.match(/^##\s+Week\s+(\d+)/i);
            if (weekMatch) {
                currentWeek = parseInt(weekMatch[1], 10);
                inTargetTable = false; // Reset when entering new week
            }

            // Check for meal type header
            if (line.toLowerCase().includes('breakfast')) {
                currentMealType = 'breakfast';
                inTargetTable = (currentWeek === weekNumber && currentMealType === mealType);
            } else if (line.toLowerCase().includes('lunch')) {
                currentMealType = 'lunch';
                inTargetTable = (currentWeek === weekNumber && currentMealType === mealType);
            } else if (line.toLowerCase().includes('dinner')) {
                currentMealType = 'dinner';
                inTargetTable = (currentWeek === weekNumber && currentMealType === mealType);
            }

            // If we're in the target table, look for existing rows
            if (inTargetTable && line.startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('day')) {
                // This is a data row in the target table
                tableEndIndex = i + 1;

                // Check if this row is for our day and is empty
                const cells = line.split('|').map(c => c.trim());
                // cells[0] is empty (before first |), cells[1] is Day, cells[2] is Meal
                if (cells[1] === day && (!cells[2] || cells[2] === '' || cells[2] === '-')) {
                    // Found empty row for this day
                    emptyRowIndex = i;
                }
            }
        }

        // If we found an empty row for this day, update it
        if (emptyRowIndex >= 0) {
            const newRow = `| ${day} | ${wikilink} | - | - | - | |`;
            lines[emptyRowIndex] = newRow;
            console.log(`MealPlanService: Updated existing row for ${day} at line ${emptyRowIndex + 1}`);
        } else if (tableEndIndex > 0) {
            // Insert new row at end of table
            const newRow = `| ${day} | ${wikilink} | - | - | - | |`;
            lines.splice(tableEndIndex, 0, newRow);
            console.log(`MealPlanService: Inserted new row after line ${tableEndIndex}`);
        } else {
            // Fallback: append to end of file
            const newRow = `| ${day} | ${wikilink} | - | - | - | |`;
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
