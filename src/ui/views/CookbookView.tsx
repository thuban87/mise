/**
 * CookbookView - Full-tab ItemView for browsing recipes
 * 
 * Uses React for rendering the cookbook UI.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { MISE_COOKBOOK_VIEW_TYPE } from '../../utils/constants';
import { CookbookApp, RecipeProvider } from '../components';
import { RecipeIndexer, MealPlanService } from '../../services';
import type MisePlugin from '../../main';

export class CookbookView extends ItemView {
    private root: Root | null = null;
    private plugin: MisePlugin;

    constructor(leaf: WorkspaceLeaf, plugin: MisePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return MISE_COOKBOOK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Cookbook';
    }

    getIcon(): string {
        return 'book-open';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('mise-cookbook-container');

        // Create React root and render app
        this.root = createRoot(container);
        this.root.render(
            <RecipeProvider
                app={this.app}
                indexer={this.plugin.indexer}
                mealPlanService={this.plugin.mealPlanService}
                onLogMeal={(recipe, editedIngredients) => {
                    // Import and open LogMealModal with pre-selected recipe and edited ingredients
                    import('../components/LogMealModal').then(({ LogMealModal }) => {
                        new LogMealModal(
                            this.app,
                            this.plugin.settings,
                            this.plugin.mealPlanService,
                            this.plugin.inventoryService,
                            this.plugin.ingredientIndex,
                            this.plugin.indexer,
                            recipe,
                            editedIngredients
                        ).open();
                    });
                }}
            >
                <CookbookApp />
            </RecipeProvider>
        );
    }

    async onClose(): Promise<void> {
        // Clean up React root
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }
}
