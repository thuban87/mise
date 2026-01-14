/**
 * MealCalendar - Monthly/Weekly calendar view for meal plans
 * Supports drag-and-drop to add/move/delete meals
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { App } from 'obsidian';
import { PlannedMeal } from '../../types';
import { MealPlanService } from '../../services';
import { MealTypePicker, MealType } from './MealTypePicker';

interface MealCalendarProps {
    mealPlanService: MealPlanService;
    app: App;
}

interface DayData {
    date: Date;
    dayNum: number;
    weekOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    meals: {
        breakfast: PlannedMeal[];
        lunch: PlannedMeal[];
        dinner: PlannedMeal[];
    };
}

interface DropTarget {
    day: string;
    weekNumber: number;
    position: { x: number; y: number };
}

interface DraggedRecipe {
    title: string;
    path: string | null;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export function MealCalendar({ mealPlanService, app }: MealCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [refreshKey, setRefreshKey] = useState(0);
    const [dragOverDay, setDragOverDay] = useState<string | null>(null);

    // Use ref for calendar container to toggle drag class without re-render
    const calendarRef = useRef<HTMLDivElement>(null);

    // Picker state
    const [pickerVisible, setPickerVisible] = useState(false);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [draggedRecipe, setDraggedRecipe] = useState<DraggedRecipe | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get all meals from service (refreshes when refreshKey changes)
    const allMeals = useMemo(() => {
        return mealPlanService.getAllMeals();
    }, [mealPlanService, refreshKey]);

    // Calculate which week of the month a date falls in
    const getWeekOfMonth = (date: Date): number => {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstDayWeekday = firstDayOfMonth.getDay();
        return Math.ceil((date.getDate() + firstDayWeekday) / 7);
    };

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const days: DayData[] = [];
        const today = new Date();

        // First day of the month
        const firstDay = new Date(year, month, 1);
        const startingDayOfWeek = firstDay.getDay();

        // Last day of the month
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();

        // Days from previous month
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayNum = prevMonthLastDay - i;
            const date = new Date(year, month - 1, dayNum);
            days.push({
                date,
                dayNum,
                weekOfMonth: 0,
                isCurrentMonth: false,
                isToday: false,
                meals: { breakfast: [], lunch: [], dinner: [] },
            });
        }

        // Days of current month
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            const dayName = DAYS_OF_WEEK[date.getDay()];
            const weekOfMonth = getWeekOfMonth(date);
            const monthName = MONTHS[month];

            // Find meals for this specific day, week, AND month
            const dayMeals = allMeals.filter(m =>
                m.day === dayName &&
                m.weekNumber === weekOfMonth &&
                m.planMonth === monthName &&
                m.planYear === year
            );

            days.push({
                date,
                dayNum: day,
                weekOfMonth,
                isCurrentMonth: true,
                isToday,
                meals: {
                    breakfast: dayMeals.filter(m => m.mealType === 'breakfast'),
                    lunch: dayMeals.filter(m => m.mealType === 'lunch'),
                    dinner: dayMeals.filter(m => m.mealType === 'dinner'),
                },
            });
        }

        // Days from next month to fill the grid (6 rows x 7 = 42 cells)
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            days.push({
                date: new Date(year, month + 1, day),
                dayNum: day,
                weekOfMonth: 0,
                isCurrentMonth: false,
                isToday: false,
                meals: { breakfast: [], lunch: [], dinner: [] },
            });
        }

        return days;
    }, [year, month, allMeals]);

    // Get current week's days for week view (full 7-day row from grid)
    const currentWeekDays = useMemo(() => {
        // Find the row in the calendar grid that contains the current date
        const currentDayIndex = calendarDays.findIndex(day =>
            day.date.toDateString() === currentDate.toDateString()
        );

        if (currentDayIndex === -1) {
            // Fallback: find first day of current month in grid
            const firstMonthDayIndex = calendarDays.findIndex(day => day.isCurrentMonth);
            if (firstMonthDayIndex !== -1) {
                const rowStart = Math.floor(firstMonthDayIndex / 7) * 7;
                return calendarDays.slice(rowStart, rowStart + 7);
            }
            return calendarDays.slice(0, 7);
        }

        // Get the start of the row (week starts on Sunday)
        const rowStart = Math.floor(currentDayIndex / 7) * 7;
        return calendarDays.slice(rowStart, rowStart + 7);
    }, [calendarDays, currentDate]);

    const displayDays = viewMode === 'week' ? currentWeekDays : calendarDays;

    const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToPrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };
    const goToNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };
    const goToToday = () => setCurrentDate(new Date());

    const refresh = useCallback(() => {
        mealPlanService.initialize();
        setRefreshKey(k => k + 1);
    }, [mealPlanService]);

    // Listen for meal plan updates
    useEffect(() => {
        const handler = () => setRefreshKey(k => k + 1);
        mealPlanService.on('meal-plan-updated', handler);
        return () => mealPlanService.off('meal-plan-updated', handler);
    }, [mealPlanService]);

    // Click a day to open week view for that week
    const handleDayClick = (day: DayData) => {
        setCurrentDate(day.date);
        setViewMode('week');
    };

    // Click a meal to open the recipe
    const handleMealClick = (meal: PlannedMeal, e: React.MouseEvent) => {
        e.stopPropagation();
        if (meal.recipePath) {
            const file = app.vault.getAbstractFileByPath(meal.recipePath);
            if (file) {
                app.workspace.getLeaf().openFile(file as any);
            } else {
                // Try without .md extension
                const altPath = meal.recipePath.replace('.md', '');
                const files = app.vault.getMarkdownFiles();
                const match = files.find(f =>
                    f.basename.toLowerCase() === altPath.toLowerCase() ||
                    f.basename.toLowerCase() === meal.recipeTitle.toLowerCase()
                );
                if (match) {
                    app.workspace.getLeaf().openFile(match);
                }
            }
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent, day: DayData) => {
        if (!day.isCurrentMonth) return;
        e.preventDefault();

        // Use 'move' for meals, 'copy' for new recipes
        if (e.dataTransfer.types.includes('application/mise-meal')) {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'copy';
        }

        const dayKey = `${day.date.toISOString()}`;
        setDragOverDay(dayKey);
    };

    const handleDragLeave = () => {
        setDragOverDay(null);
    };

    const handleDrop = (e: React.DragEvent, day: DayData) => {
        e.preventDefault();
        setDragOverDay(null);

        if (!day.isCurrentMonth) return;

        // Get recipe data
        const recipeData = e.dataTransfer.getData('application/mise-recipe');
        if (!recipeData) return;

        try {
            const recipe = JSON.parse(recipeData) as DraggedRecipe;
            const dayName = DAYS_OF_WEEK[day.date.getDay()];
            const weekNumber = day.weekOfMonth;

            // Show picker (centered on page, no position needed)
            setDraggedRecipe(recipe);
            setDropTarget({
                day: dayName,
                weekNumber,
                position: { x: 0, y: 0 }, // Not used anymore
            });
            setPickerVisible(true);
        } catch (error) {
            console.error('Error parsing dropped recipe', error);
        }
    };

    // Handle meal type selection from picker
    const handleMealTypeSelect = async (mealType: MealType) => {
        if (!draggedRecipe || !dropTarget) return;

        setPickerVisible(false);

        await mealPlanService.addMeal(
            draggedRecipe.title,
            draggedRecipe.path,
            dropTarget.day,
            dropTarget.weekNumber,
            mealType
        );

        setDraggedRecipe(null);
        setDropTarget(null);
    };

    const handlePickerCancel = () => {
        setPickerVisible(false);
        setDraggedRecipe(null);
        setDropTarget(null);
    };

    // Meal pill drag handlers (for moving/deleting)
    const handleMealDragStart = (e: React.DragEvent, meal: PlannedMeal) => {
        console.log('Meal drag start:', meal.recipeTitle);
        e.dataTransfer.setData('application/mise-meal', JSON.stringify(meal));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleMealDragEnd = (e: React.DragEvent) => {
        console.log('Meal drag end');
    };

    // Handle dropping a meal pill (moving between days)
    const handleMealDrop = async (e: React.DragEvent, day: DayData) => {
        console.log('Meal drop on day:', day.dayNum);
        e.preventDefault();
        setDragOverDay(null);

        if (!day.isCurrentMonth) {
            console.log('Meal drop: not current month, ignoring');
            return;
        }

        const mealData = e.dataTransfer.getData('application/mise-meal');
        console.log('Meal drop data:', mealData);
        if (!mealData) {
            console.log('Meal drop: no meal data found');
            return;
        }

        try {
            const meal = JSON.parse(mealData) as PlannedMeal;
            const newDayName = DAYS_OF_WEEK[day.date.getDay()];
            const newWeekNumber = day.weekOfMonth;

            console.log(`Moving meal ${meal.recipeTitle} from ${meal.day} Week ${meal.weekNumber} to ${newDayName} Week ${newWeekNumber}`);

            // Remove from old location
            await mealPlanService.removeMeal(
                meal.recipeTitle,
                meal.day,
                meal.weekNumber,
                meal.mealType
            );

            // Add to new location (same meal type)
            await mealPlanService.addMeal(
                meal.recipeTitle,
                meal.recipePath,
                newDayName,
                newWeekNumber,
                meal.mealType
            );
        } catch (error) {
            console.error('Error moving meal', error);
        }
    };

    // Delete handler (drag to trash zone)
    const handleTrashDrop = async (e: React.DragEvent) => {
        e.preventDefault();

        const mealData = e.dataTransfer.getData('application/mise-meal');
        if (!mealData) return;

        try {
            const meal = JSON.parse(mealData) as PlannedMeal;
            await mealPlanService.removeMeal(
                meal.recipeTitle,
                meal.day,
                meal.weekNumber,
                meal.mealType
            );
        } catch (error) {
            console.error('Error deleting meal', error);
        }
    };

    const weekNumber = getWeekOfMonth(currentDate);

    return (
        <div className="mise-calendar" ref={calendarRef}>
            {/* Header */}
            <div className="mise-calendar-header">
                <button
                    className="mise-calendar-nav"
                    onClick={viewMode === 'month' ? goToPrevMonth : goToPrevWeek}
                    aria-label={viewMode === 'month' ? "Previous month" : "Previous week"}
                >
                    ◀
                </button>
                <div className="mise-calendar-title">
                    <h2>
                        {MONTHS[month]} {year}
                        {viewMode === 'week' && <span className="mise-week-label"> - Week {weekNumber}</span>}
                    </h2>
                    <div className="mise-calendar-controls">
                        <button className="mise-calendar-today" onClick={goToToday}>Today</button>
                        <button
                            className={`mise-calendar-view-btn ${viewMode === 'month' ? 'active' : ''}`}
                            onClick={() => setViewMode('month')}
                        >
                            Month
                        </button>
                        <button
                            className={`mise-calendar-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                            onClick={() => setViewMode('week')}
                        >
                            Week
                        </button>
                        <button className="mise-calendar-refresh" onClick={refresh} title="Refresh meal plan">
                            🔄
                        </button>
                    </div>
                </div>
                <button
                    className="mise-calendar-nav"
                    onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek}
                    aria-label={viewMode === 'month' ? "Next month" : "Next week"}
                >
                    ▶
                </button>
            </div>

            {/* Weekday Headers */}
            <div className="mise-calendar-weekdays">
                {DAYS_OF_WEEK.map(day => (
                    <div key={day} className="mise-calendar-weekday">{day}</div>
                ))}
            </div>

            {/* Trash Zone - visible via CSS when calendar has mise-calendar-dragging class */}
            <div
                className="mise-trash-zone"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={handleTrashDrop}
            >
                🗑️ Drop here to delete
            </div>

            {/* Calendar Grid */}
            <div className={`mise-calendar-grid ${viewMode === 'week' ? 'mise-week-view' : ''}`}>
                {displayDays.map((day, idx) => (
                    <div
                        key={idx}
                        className={`mise-calendar-day ${!day.isCurrentMonth ? 'mise-day-other-month' : ''
                            } ${day.isToday ? 'mise-day-today' : ''
                            } ${dragOverDay === day.date.toISOString() ? 'mise-day-dragover' : ''}`}
                        onClick={() => handleDayClick(day)}
                        onDragOver={(e) => handleDragOver(e, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                            // Check if it's a meal being moved
                            if (e.dataTransfer.types.includes('application/mise-meal')) {
                                handleMealDrop(e, day);
                            } else {
                                handleDrop(e, day);
                            }
                        }}
                    >
                        <div className="mise-day-number">{day.dayNum}</div>
                        <div className="mise-day-meals">
                            {day.meals.breakfast.length > 0 && (
                                <div className="mise-meal-slot mise-meal-breakfast">
                                    {day.meals.breakfast.map((meal, i) => (
                                        <span
                                            key={i}
                                            className="mise-meal-pill mise-meal-clickable mise-meal-draggable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
                                            draggable
                                            onDragStart={(e) => handleMealDragStart(e, meal)}
                                            onDragEnd={handleMealDragEnd}
                                        >
                                            🍳 {meal.recipeTitle}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {day.meals.lunch.length > 0 && (
                                <div className="mise-meal-slot mise-meal-lunch">
                                    {day.meals.lunch.map((meal, i) => (
                                        <span
                                            key={i}
                                            className="mise-meal-pill mise-meal-clickable mise-meal-draggable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
                                            draggable
                                            onDragStart={(e) => handleMealDragStart(e, meal)}
                                            onDragEnd={handleMealDragEnd}
                                        >
                                            🥗 {meal.recipeTitle}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {day.meals.dinner.length > 0 && (
                                <div className="mise-meal-slot mise-meal-dinner">
                                    {day.meals.dinner.map((meal, i) => (
                                        <span
                                            key={i}
                                            className="mise-meal-pill mise-meal-clickable mise-meal-draggable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
                                            draggable
                                            onDragStart={(e) => handleMealDragStart(e, meal)}
                                            onDragEnd={handleMealDragEnd}
                                        >
                                            🍽️ {meal.recipeTitle}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Meal Type Picker */}
            <MealTypePicker
                visible={pickerVisible}
                onSelect={handleMealTypeSelect}
                onCancel={handlePickerCancel}
            />
        </div>
    );
}

function getMealTooltip(meal: PlannedMeal): string {
    const parts = [meal.recipeTitle];
    if (meal.protein) parts.push(`Protein: ${meal.protein}`);
    if (meal.side1) parts.push(`Side 1: ${meal.side1}`);
    if (meal.side2) parts.push(`Side 2: ${meal.side2}`);
    if (meal.notes) parts.push(`Notes: ${meal.notes}`);
    return parts.join('\n');
}
