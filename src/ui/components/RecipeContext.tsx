/**
 * Recipe Context - Provides recipe data, modal state, and ingredient tracking to React components
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { App } from 'obsidian';
import { Recipe } from '../../types';
import { RecipeIndexer } from '../../services';

interface RecipeContextValue {
    app: App;
    recipes: Recipe[];
    isLoading: boolean;
    openRecipe: (path: string) => void;
    getImageUrl: (imagePath: string | null) => string | null;
    // Modal state
    selectedRecipe: Recipe | null;
    openModal: (recipe: Recipe) => void;
    closeModal: () => void;
    // Ingredient checkbox state (session only)
    isIngredientChecked: (recipePath: string, ingredientIndex: number) => boolean;
    toggleIngredient: (recipePath: string, ingredientIndex: number) => void;
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
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    // Map of recipe path -> Set of checked ingredient indices
    const [checkedIngredients, setCheckedIngredients] = useState<Map<string, Set<number>>>(new Map());

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

    const getImageUrl = (imagePath: string | null): string | null => {
        if (!imagePath) return null;

        // If it's already a URL, return as-is
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }

        // Convert vault path to resource URL
        return app.vault.adapter.getResourcePath(imagePath);
    };

    // Modal functions
    const openModal = useCallback((recipe: Recipe) => {
        setSelectedRecipe(recipe);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedRecipe(null);
    }, []);

    // Ingredient checkbox functions
    const isIngredientChecked = useCallback((recipePath: string, ingredientIndex: number): boolean => {
        const recipeChecked = checkedIngredients.get(recipePath);
        return recipeChecked?.has(ingredientIndex) ?? false;
    }, [checkedIngredients]);

    const toggleIngredient = useCallback((recipePath: string, ingredientIndex: number) => {
        setCheckedIngredients(prev => {
            const newMap = new Map(prev);
            const recipeSet = new Set(newMap.get(recipePath) ?? []);

            if (recipeSet.has(ingredientIndex)) {
                recipeSet.delete(ingredientIndex);
            } else {
                recipeSet.add(ingredientIndex);
            }

            newMap.set(recipePath, recipeSet);
            return newMap;
        });
    }, []);

    return (
        <RecipeContext.Provider value={{
            app,
            recipes,
            isLoading,
            openRecipe,
            getImageUrl,
            selectedRecipe,
            openModal,
            closeModal,
            isIngredientChecked,
            toggleIngredient,
        }}>
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
