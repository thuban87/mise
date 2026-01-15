/**
 * MealPlanView - Full-tab ItemView for the meal plan calendar
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { MealCalendar, RecipeProvider } from '../components';
import type MisePlugin from '../../main';

export const MISE_MEAL_PLAN_VIEW_TYPE = 'mise-meal-plan-view';

export class MealPlanView extends ItemView {
    private root: Root | null = null;
    private plugin: MisePlugin;

    constructor(leaf: WorkspaceLeaf, plugin: MisePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return MISE_MEAL_PLAN_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Meal Plan';
    }

    getIcon(): string {
        return 'calendar';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('mise-meal-plan-container');

        // Create React root and render calendar
        this.root = createRoot(container);
        this.root.render(
            <RecipeProvider
                app={this.app}
                indexer={this.plugin.indexer}
                mealPlanService={this.plugin.mealPlanService}
            >
                <MealCalendar
                    mealPlanService={this.plugin.mealPlanService}
                    app={this.app}
                />
            </RecipeProvider>
        );
    }

    async onClose(): Promise<void> {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }
}
