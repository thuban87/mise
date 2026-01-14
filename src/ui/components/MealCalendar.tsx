/**
 * MealCalendar - Monthly/Weekly calendar view for meal plans
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { App } from 'obsidian';
import { PlannedMeal } from '../../types';
import { MealPlanService } from '../../services';

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

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export function MealCalendar({ mealPlanService, app }: MealCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [refreshKey, setRefreshKey] = useState(0);

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

    const goToPrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

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

    const goToToday = () => {
        setCurrentDate(new Date());
    };

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

    const weekNumber = getWeekOfMonth(currentDate);

    return (
        <div className="mise-calendar">
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
                        <button
                            className="mise-calendar-today"
                            onClick={goToToday}
                        >
                            Today
                        </button>
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
                        <button
                            className="mise-calendar-refresh"
                            onClick={refresh}
                            title="Refresh meal plan"
                        >
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

            {/* Calendar Grid */}
            <div className={`mise-calendar-grid ${viewMode === 'week' ? 'mise-week-view' : ''}`}>
                {displayDays.map((day, idx) => (
                    <div
                        key={idx}
                        className={`mise-calendar-day ${!day.isCurrentMonth ? 'mise-day-other-month' : ''
                            } ${day.isToday ? 'mise-day-today' : ''}`}
                        onClick={() => handleDayClick(day)}
                    >
                        <div className="mise-day-number">{day.dayNum}</div>
                        <div className="mise-day-meals">
                            {day.meals.breakfast.length > 0 && (
                                <div className="mise-meal-slot mise-meal-breakfast">
                                    {day.meals.breakfast.map((meal, i) => (
                                        <span
                                            key={i}
                                            className="mise-meal-pill mise-meal-clickable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
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
                                            className="mise-meal-pill mise-meal-clickable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
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
                                            className="mise-meal-pill mise-meal-clickable"
                                            title={getMealTooltip(meal)}
                                            onClick={(e) => handleMealClick(meal, e)}
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
