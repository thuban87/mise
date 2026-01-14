/**
 * Recipe Context - Provides recipe data, modal state, filters, and ingredient tracking
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { App } from 'obsidian';
import { Recipe, RecipeCategory, DietaryFlag } from '../../types';
import { RecipeIndexer, MealPlanService } from '../../services';

export type SortOption = 'rating' | 'time' | 'alpha' | 'recent';

interface RecipeContextValue {
    app: App;
    recipes: Recipe[];
    filteredRecipes: Recipe[];
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
    // Filter state
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedCategory: RecipeCategory | null;
    setSelectedCategory: (category: RecipeCategory | null) => void;
    minRating: number;
    setMinRating: (rating: number) => void;
    maxTime: number | null;
    setMaxTime: (time: number | null) => void;
    selectedDietaryFlags: DietaryFlag[];
    toggleDietaryFlag: (flag: DietaryFlag) => void;
    unratedOnly: boolean;
    setUnratedOnly: (value: boolean) => void;
    missingImageOnly: boolean;
    setMissingImageOnly: (value: boolean) => void;
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
    clearFilters: () => void;
    hasActiveFilters: boolean;
    categories: RecipeCategory[];
    allDietaryFlags: DietaryFlag[];
    // Meal plan
    getPlannedDays: (recipeTitle: string) => string;
}

const RecipeContext = createContext<RecipeContextValue | null>(null);

interface RecipeProviderProps {
    app: App;
    indexer: RecipeIndexer;
    mealPlanService?: MealPlanService;
    children: ReactNode;
}

export function RecipeProvider({ app, indexer, mealPlanService, children }: RecipeProviderProps) {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [checkedIngredients, setCheckedIngredients] = useState<Map<string, Set<number>>>(new Map());

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | null>(null);
    const [minRating, setMinRating] = useState(0);
    const [maxTime, setMaxTime] = useState<number | null>(null);
    const [selectedDietaryFlags, setSelectedDietaryFlags] = useState<DietaryFlag[]>([]);
    const [unratedOnly, setUnratedOnly] = useState(false);
    const [missingImageOnly, setMissingImageOnly] = useState(false);
    const [sortOption, setSortOption] = useState<SortOption>('alpha');

    useEffect(() => {
        const loadRecipes = () => {
            setRecipes(indexer.getRecipes());
            setIsLoading(false);
        };

        const handleReady = () => loadRecipes();
        const handleChange = () => setRecipes(indexer.getRecipes());

        if (indexer.isReady()) {
            loadRecipes();
        }

        indexer.on('index-ready', handleReady);
        indexer.on('recipe-added', handleChange);
        indexer.on('recipe-updated', handleChange);
        indexer.on('recipe-deleted', handleChange);

        return () => {
            indexer.off('index-ready', handleReady);
            indexer.off('recipe-added', handleChange);
            indexer.off('recipe-updated', handleChange);
            indexer.off('recipe-deleted', handleChange);
        };
    }, [indexer]);

    // Get unique categories from recipes
    const categories = useMemo(() => {
        const cats = new Set<RecipeCategory>();
        recipes.forEach(r => cats.add(r.category));
        return Array.from(cats).sort();
    }, [recipes]);

    // Get all dietary flags from recipes
    const allDietaryFlags = useMemo(() => {
        const flags = new Set<DietaryFlag>();
        recipes.forEach(r => r.dietaryFlags.forEach(f => flags.add(f)));
        return Array.from(flags).sort();
    }, [recipes]);

    // Filter and sort recipes
    const filteredRecipes = useMemo(() => {
        let result = [...recipes];

        // Search filter (title + ingredients)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(query) ||
                r.ingredients.some(ing => ing.toLowerCase().includes(query))
            );
        }

        // Category filter
        if (selectedCategory) {
            result = result.filter(r => r.category === selectedCategory);
        }

        // Min rating filter
        if (minRating > 0) {
            result = result.filter(r => (r.rating ?? 0) >= minRating);
        }

        // Unrated only filter
        if (unratedOnly) {
            result = result.filter(r => r.rating === null);
        }

        // Max time filter
        if (maxTime !== null) {
            result = result.filter(r => {
                const totalTime = (r.prepTime ?? 0) + (r.cookTime ?? 0);
                return totalTime > 0 && totalTime <= maxTime;
            });
        }

        // Dietary flags filter (AND logic - must have ALL selected flags)
        if (selectedDietaryFlags.length > 0) {
            result = result.filter(r =>
                selectedDietaryFlags.every(flag => r.dietaryFlags.includes(flag))
            );
        }

        // Missing image filter
        if (missingImageOnly) {
            result = result.filter(r => !r.image);
        }

        // Sort
        result.sort((a, b) => {
            switch (sortOption) {
                case 'rating':
                    const ratingA = a.rating ?? 0;
                    const ratingB = b.rating ?? 0;
                    return ratingB - ratingA;
                case 'time':
                    const timeA = (a.prepTime ?? 0) + (a.cookTime ?? 0);
                    const timeB = (b.prepTime ?? 0) + (b.cookTime ?? 0);
                    return timeA - timeB;
                case 'recent':
                    return b.lastModified - a.lastModified;
                case 'alpha':
                default:
                    return a.title.localeCompare(b.title);
            }
        });

        return result;
    }, [recipes, searchQuery, selectedCategory, minRating, maxTime, selectedDietaryFlags, unratedOnly, missingImageOnly, sortOption]);

    const hasActiveFilters = searchQuery !== '' ||
        selectedCategory !== null ||
        minRating > 0 ||
        maxTime !== null ||
        selectedDietaryFlags.length > 0 ||
        missingImageOnly ||
        unratedOnly ||
        sortOption !== 'alpha';

    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setSelectedCategory(null);
        setMinRating(0);
        setMaxTime(null);
        setSelectedDietaryFlags([]);
        setUnratedOnly(false);
        setMissingImageOnly(false);
        setSortOption('alpha');
    }, []);

    const toggleDietaryFlag = useCallback((flag: DietaryFlag) => {
        setSelectedDietaryFlags(prev =>
            prev.includes(flag)
                ? prev.filter(f => f !== flag)
                : [...prev, flag]
        );
    }, []);

    const openRecipe = (path: string) => {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
            app.workspace.getLeaf(false).openFile(file as any);
        }
    };

    const getImageUrl = (imagePath: string | null): string | null => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        return app.vault.adapter.getResourcePath(imagePath);
    };

    const openModal = useCallback((recipe: Recipe) => {
        setSelectedRecipe(recipe);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedRecipe(null);
    }, []);

    const isIngredientChecked = useCallback((recipePath: string, ingredientIndex: number): boolean => {
        return checkedIngredients.get(recipePath)?.has(ingredientIndex) ?? false;
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
    const getPlannedDays = useCallback((recipeTitle: string): string => {
        if (!mealPlanService) return '';
        return mealPlanService.getPlannedDaysSummary(recipeTitle);
    }, [mealPlanService]);

    return (
        <RecipeContext.Provider value={{
            app,
            recipes,
            filteredRecipes,
            isLoading,
            openRecipe,
            getImageUrl,
            selectedRecipe,
            openModal,
            closeModal,
            isIngredientChecked,
            toggleIngredient,
            searchQuery,
            setSearchQuery,
            selectedCategory,
            setSelectedCategory,
            minRating,
            setMinRating,
            maxTime,
            setMaxTime,
            selectedDietaryFlags,
            toggleDietaryFlag,
            unratedOnly,
            setUnratedOnly,
            missingImageOnly,
            setMissingImageOnly,
            sortOption,
            setSortOption,
            clearFilters,
            hasActiveFilters,
            categories,
            allDietaryFlags,
            getPlannedDays,
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
