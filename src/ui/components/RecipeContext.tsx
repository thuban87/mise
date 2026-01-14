/**
 * Recipe Context - Provides recipe data and app instance to React components
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { App } from 'obsidian';
import { Recipe } from '../../types';
import { RecipeIndexer } from '../../services';

interface RecipeContextValue {
    app: App;
    recipes: Recipe[];
    isLoading: boolean;
    openRecipe: (path: string) => void;
}

const RecipeContext = createContext<RecipeContextValue | null>(null);

interface RecipeProviderProps {
    app: App;
    indexer: RecipeIndexer;
    children: ReactNode;
}

export function RecipeProvider({ app, indexer, children }: RecipeProviderProps) {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial load
        const loadRecipes = () => {
            setRecipes(indexer.getRecipes());
            setIsLoading(false);
        };

        // Subscribe to indexer events
        const handleReady = () => {
            loadRecipes();
        };

        const handleChange = () => {
            setRecipes(indexer.getRecipes());
        };

        // If already initialized, load immediately
        if (indexer.isReady()) {
            loadRecipes();
        }

        // Register event handlers
        indexer.on('index-ready', handleReady);
        indexer.on('recipe-added', handleChange);
        indexer.on('recipe-updated', handleChange);
        indexer.on('recipe-deleted', handleChange);

        return () => {
            // Clean up event handlers
            indexer.off('index-ready', handleReady);
            indexer.off('recipe-added', handleChange);
            indexer.off('recipe-updated', handleChange);
            indexer.off('recipe-deleted', handleChange);
        };
    }, [indexer]);

    const openRecipe = (path: string) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
            app.workspace.getLeaf(false).openFile(file as any);
        }
    };

    return (
        <RecipeContext.Provider value={{ app, recipes, isLoading, openRecipe }}>
            {children}
        </RecipeContext.Provider>
    );
}

export function useRecipes(): RecipeContextValue {
    const context = useContext(RecipeContext);
    if (!context) {
        throw new Error('useRecipes must be used within a RecipeProvider');
    }
    return context;
}
