/**
 * CookbookSidebar - Right sidebar view for browsing recipes
 * 
 * Same as CookbookView but optimized for sidebar layout.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { MISE_SIDEBAR_VIEW_TYPE } from '../../utils/constants';
import { CookbookApp, RecipeProvider } from '../components';
import type MisePlugin from '../../main';

export class CookbookSidebar extends ItemView {
    private root: Root | null = null;
    private plugin: MisePlugin;

    constructor(leaf: WorkspaceLeaf, plugin: MisePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return MISE_SIDEBAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Recipes';
    }

    getIcon(): string {
        return 'utensils';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('mise-sidebar-container');

        // Create React root and render app in compact mode
        this.root = createRoot(container);
        this.root.render(
            <RecipeProvider
                app={this.app}
                indexer={this.plugin.indexer}
                mealPlanService={this.plugin.mealPlanService}
            >
                <CookbookApp compact={true} />
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
