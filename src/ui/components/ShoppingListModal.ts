/**
 * ShoppingListModal - Multi-step modal for generating shopping lists
 * 
 * Flow:
 * 1) Time Selection (Quick Trip placeholder, Week/Month, Bulk Buy toggle)
 * 2) Category Selection (only if Bulk Buy)
 * 3) Store Selection
 * 4) Items Selection (optional)
 */

import { App, Modal, Setting } from 'obsidian';
import { MiseSettings, ShoppingItem } from '../../types';

type TimeRange = {
    type: 'week';
    weekNumber: number;
    label: string;
    startDate: string;
    endDate: string;
} | {
    type: 'month';
    label: string;
    startDate: string;
    endDate: string;
};

interface WeekInfo {
    weekNumber: number;
    startDate: string;
    endDate: string;
}

export interface ShoppingListModalResult {
    timeRange: TimeRange;
    storeId: string | null;  // null = General
    selectedItems: ShoppingItem[] | null;  // null = all items
    bulkBuyMode: boolean;
    selectedCategories: string[] | null;  // null = all categories
    quickTrip: boolean;
    quickTripDays: number;
    dateRangeLabel: string;  // Human-readable date range for filename
}

// Default aisle categories for bulk buy filtering
const AISLE_CATEGORIES = [
    'Produce',
    'Meat',
    'Dairy',
    'Bakery',
    'Frozen',
    'Pantry',
    'Beverages',
    'Other'
];

export class ShoppingListModal extends Modal {
    private settings: MiseSettings;
    private weeks: WeekInfo[];
    private allItems: ShoppingItem[];
    private onGenerate: (result: ShoppingListModalResult) => void;
    private inventoryEnabled: boolean;

    // State
    private step: 1 | 2 | 3 | 4 = 1;
    private selectedTimeRange: TimeRange | null = null;
    private selectedStoreId: string | null = null;
    private selectSpecificItems: boolean = false;
    private itemSelections: Map<string, boolean> = new Map();

    // New state for bulk buy and quick trip
    private bulkBuyMode: boolean = false;
    private selectedCategories: Set<string> = new Set(AISLE_CATEGORIES);
    private quickTrip: boolean = false;
    private quickTripDays: number = 3;

    constructor(
        app: App,
        settings: MiseSettings,
        weeks: WeekInfo[],
        allItems: ShoppingItem[],
        onGenerate: (result: ShoppingListModalResult) => void,
        inventoryEnabled: boolean = false  // Phase 16 will pass true
    ) {
        super(app);
        this.settings = settings;
        this.weeks = weeks;
        this.allItems = allItems;
        this.onGenerate = onGenerate;
        this.inventoryEnabled = inventoryEnabled;

        // Initialize all items as selected by default
        for (const item of allItems) {
            this.itemSelections.set(item.ingredient, true);
        }
    }

    onOpen() {
        this.modalEl.addClass('mise-shopping-modal-container');
        this.renderStep();
    }

    private renderStep() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-shopping-modal');

        switch (this.step) {
            case 1:
                this.renderTimeRangeStep();
                break;
            case 2:
                this.renderCategoryStep();
                break;
            case 3:
                this.renderStoreStep();
                break;
            case 4:
                this.renderItemsStep();
                break;
        }
    }

    private renderTimeRangeStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Generate Shopping List' });

        // Quick Trip (Perishables) - Disabled placeholder until Phase 16
        const quickTripSetting = new Setting(contentEl)
            .setName('🚀 Quick Trip (Perishables)')
            .setClass('mise-quick-trip-setting');

        if (this.inventoryEnabled) {
            quickTripSetting
                .setDesc('Generate a list of items expiring soon')
                .addToggle(toggle => {
                    toggle.setValue(this.quickTrip)
                        .onChange(value => {
                            this.quickTrip = value;
                            this.renderStep();
                        });
                });

            // Show days dropdown if Quick Trip is enabled
            if (this.quickTrip) {
                new Setting(contentEl)
                    .setName('Expiring within')
                    .setClass('mise-quick-trip-days')
                    .addDropdown(dropdown => {
                        dropdown
                            .addOption('1', '1 day')
                            .addOption('2', '2 days')
                            .addOption('3', '3 days')
                            .addOption('5', '5 days')
                            .addOption('7', '1 week')
                            .setValue(String(this.quickTripDays))
                            .onChange(value => {
                                this.quickTripDays = parseInt(value);
                            });
                    });
            }
        } else {
            quickTripSetting
                .setDesc('🔒 Requires Inventory System (Phase 16)')
                .addToggle(toggle => {
                    toggle.setValue(false).setDisabled(true);
                });
            quickTripSetting.settingEl.addClass('mise-disabled-setting');
        }

        // Separator
        contentEl.createEl('hr');

        // Time Range Selection
        contentEl.createEl('h3', { text: 'Time Range' });
        const container = contentEl.createDiv('mise-modal-options');

        // Week options
        for (const week of this.weeks) {
            const label = `Week ${week.weekNumber} (${week.startDate} - ${week.endDate})`;
            new Setting(container)
                .setName(label)
                .addToggle(toggle => {
                    toggle
                        .setValue(this.selectedTimeRange?.type === 'week' &&
                            this.selectedTimeRange.weekNumber === week.weekNumber)
                        .onChange(() => {
                            this.selectedTimeRange = {
                                type: 'week',
                                weekNumber: week.weekNumber,
                                label,
                                startDate: week.startDate,
                                endDate: week.endDate,
                            };
                            this.bulkBuyMode = false; // Reset bulk buy when switching to week
                            this.renderStep();
                        });
                });
        }

        // Entire month option
        new Setting(container)
            .setName('Entire Month')
            .addToggle(toggle => {
                toggle
                    .setValue(this.selectedTimeRange?.type === 'month')
                    .onChange(() => {
                        // For month, use first and last day of current month
                        const now = new Date();
                        const monthName = now.toLocaleString('default', { month: 'long' });
                        const year = now.getFullYear();
                        const firstDay = 1;
                        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
                        this.selectedTimeRange = {
                            type: 'month',
                            label: monthName,
                            startDate: `${monthName} ${firstDay}`,
                            endDate: `${monthName} ${lastDay}`,
                        };
                        this.renderStep();
                    });
            });

        // Bulk Buy Mode (only visible when Month is selected)
        if (this.selectedTimeRange?.type === 'month') {
            contentEl.createEl('hr');
            new Setting(contentEl)
                .setName('🛒 Bulk Buy Mode')
                .setDesc('Filter by category (e.g., Costco run for meat + pantry)')
                .addToggle(toggle => {
                    toggle
                        .setValue(this.bulkBuyMode)
                        .onChange(value => {
                            this.bulkBuyMode = value;
                            if (!value) {
                                // Reset categories when disabling bulk buy
                                this.selectedCategories = new Set(AISLE_CATEGORIES);
                            }
                        });
                });
        }

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const nextBtn = navDiv.createEl('button', { text: 'Next →', cls: 'mod-cta' });
        nextBtn.disabled = !this.selectedTimeRange && !this.quickTrip;
        nextBtn.onclick = () => {
            if (this.quickTrip) {
                // Quick trip skips to generate directly
                this.complete();
                return;
            }
            if (this.selectedTimeRange) {
                // If month + bulk buy -> go to category step
                // Otherwise skip to store step
                if (this.selectedTimeRange.type === 'month' && this.bulkBuyMode) {
                    this.step = 2;
                } else {
                    this.step = 3;
                }
                this.renderStep();
            }
        };
    }

    private renderCategoryStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Select Categories' });
        contentEl.createEl('p', {
            text: 'Choose which categories to include in your bulk buy list.',
            cls: 'mise-modal-description'
        });

        // Select All / None buttons
        const btnRow = contentEl.createDiv('mise-modal-btn-row');

        const selectAllBtn = btnRow.createEl('button', { text: 'Select All' });
        selectAllBtn.onclick = () => {
            this.selectedCategories = new Set(AISLE_CATEGORIES);
            this.renderStep();
        };

        const selectNoneBtn = btnRow.createEl('button', { text: 'Select None' });
        selectNoneBtn.onclick = () => {
            this.selectedCategories.clear();
            this.renderStep();
        };

        // Category checkboxes in a grid
        const container = contentEl.createDiv('mise-category-grid');

        for (const category of AISLE_CATEGORIES) {
            const itemDiv = container.createDiv('mise-category-item');

            const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
            checkbox.id = `cat-${category}`;
            checkbox.checked = this.selectedCategories.has(category);
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    this.selectedCategories.add(category);
                } else {
                    this.selectedCategories.delete(category);
                }
            };

            const label = itemDiv.createEl('label');
            label.htmlFor = `cat-${category}`;
            label.setText(category);
        }

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const backBtn = navDiv.createEl('button', { text: '← Back' });
        backBtn.onclick = () => {
            this.step = 1;
            this.renderStep();
        };

        const nextBtn = navDiv.createEl('button', { text: 'Next →', cls: 'mod-cta' });
        nextBtn.disabled = this.selectedCategories.size === 0;
        nextBtn.onclick = () => {
            this.step = 3;
            this.renderStep();
        };
    }

    private renderStoreStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Select Store' });

        const container = contentEl.createDiv('mise-modal-options');

        // General option (always first)
        new Setting(container)
            .setName('General (default)')
            .setDesc('Uses default aisle categories')
            .addToggle(toggle => {
                toggle
                    .setValue(this.selectedStoreId === null)
                    .onChange(() => {
                        this.selectedStoreId = null;
                        this.renderStep();
                    });
            });

        // Store profiles
        for (const profile of this.settings.storeProfiles) {
            new Setting(container)
                .setName(profile.name)
                .addToggle(toggle => {
                    toggle
                        .setValue(this.selectedStoreId === profile.id)
                        .onChange(() => {
                            this.selectedStoreId = profile.id;
                            this.renderStep();
                        });
                });
        }

        // Select specific items toggle
        contentEl.createEl('hr');
        new Setting(contentEl)
            .setName('Select specific items')
            .setDesc('Choose which items to include in this list')
            .addToggle(toggle => {
                toggle
                    .setValue(this.selectSpecificItems)
                    .onChange(value => {
                        this.selectSpecificItems = value;
                        this.renderStep();  // Re-render to update button text
                    });
            });

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const backBtn = navDiv.createEl('button', { text: '← Back' });
        backBtn.onclick = () => {
            // Go back to categories if bulk buy, otherwise time range
            if (this.bulkBuyMode) {
                this.step = 2;
            } else {
                this.step = 1;
            }
            this.renderStep();
        };

        const nextBtn = navDiv.createEl('button', {
            text: this.selectSpecificItems ? 'Next →' : 'Generate',
            cls: 'mod-cta'
        });
        nextBtn.onclick = () => {
            if (this.selectSpecificItems) {
                this.step = 4;
                this.renderStep();
            } else {
                this.complete();
            }
        };
    }

    private renderItemsStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Select Items' });

        // Select All / None buttons
        const btnRow = contentEl.createDiv('mise-modal-btn-row');

        const selectAllBtn = btnRow.createEl('button', { text: 'Select All' });
        selectAllBtn.onclick = () => {
            for (const item of this.allItems) {
                this.itemSelections.set(item.ingredient, true);
            }
            this.renderStep();
        };

        const selectNoneBtn = btnRow.createEl('button', { text: 'Select None' });
        selectNoneBtn.onclick = () => {
            for (const item of this.allItems) {
                this.itemSelections.set(item.ingredient, false);
            }
            this.renderStep();
        };

        // Item checkboxes
        const container = contentEl.createDiv('mise-modal-items');

        for (const item of this.allItems) {
            const itemDiv = container.createDiv('mise-modal-item');

            const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
            checkbox.checked = this.itemSelections.get(item.ingredient) ?? true;
            checkbox.onchange = () => {
                this.itemSelections.set(item.ingredient, checkbox.checked);
            };

            itemDiv.createSpan({ text: item.ingredient });

            if (item.fromRecipes.length > 0) {
                const recipeSpan = itemDiv.createSpan({ cls: 'mise-modal-item-recipes' });
                recipeSpan.setText(`(${item.fromRecipes.join(', ')})`);
            }
        }

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const backBtn = navDiv.createEl('button', { text: '← Back' });
        backBtn.onclick = () => {
            this.step = 3;
            this.renderStep();
        };

        const generateBtn = navDiv.createEl('button', { text: 'Generate', cls: 'mod-cta' });
        generateBtn.onclick = () => this.complete();
    }

    private complete() {
        const selectedItems = this.selectSpecificItems
            ? this.allItems.filter(item => this.itemSelections.get(item.ingredient))
            : null;

        const selectedCategories = this.bulkBuyMode
            ? Array.from(this.selectedCategories)
            : null;

        // Build date range label for filename
        // Format: "January 19-25" or "January 27 - February 2" for split weeks
        let dateRangeLabel = '';
        if (this.selectedTimeRange) {
            const startDate = this.selectedTimeRange.startDate;
            const endDate = this.selectedTimeRange.endDate;

            if (startDate && endDate) {
                // Parse to extract month and day parts
                // startDate format: "Jan 6" or "January 6"
                const startMatch = startDate.match(/([A-Za-z]+)\s*(\d+)/);
                const endMatch = endDate.match(/([A-Za-z]+)\s*(\d+)/);

                if (startMatch && endMatch) {
                    const startMonth = startMatch[1];
                    const startDay = startMatch[2];
                    const endMonth = endMatch[1];
                    const endDay = endMatch[2];

                    // Expand short month names to full
                    const expandMonth = (m: string) => {
                        const months: Record<string, string> = {
                            'jan': 'January', 'feb': 'February', 'mar': 'March',
                            'apr': 'April', 'may': 'May', 'jun': 'June',
                            'jul': 'July', 'aug': 'August', 'sep': 'September',
                            'oct': 'October', 'nov': 'November', 'dec': 'December'
                        };
                        return months[m.toLowerCase().substring(0, 3)] || m;
                    };

                    const fullStartMonth = expandMonth(startMonth);
                    const fullEndMonth = expandMonth(endMonth);

                    if (fullStartMonth === fullEndMonth) {
                        // Same month: "January 19-25"
                        dateRangeLabel = `${fullStartMonth} ${startDay}-${endDay}`;
                    } else {
                        // Different months: "January 27 - February 2"
                        dateRangeLabel = `${fullStartMonth} ${startDay} - ${fullEndMonth} ${endDay}`;
                    }
                } else {
                    dateRangeLabel = `${startDate} - ${endDate}`;
                }
            } else {
                dateRangeLabel = this.selectedTimeRange.label;
            }
        }

        this.onGenerate({
            timeRange: this.selectedTimeRange!,
            storeId: this.selectedStoreId,
            selectedItems,
            bulkBuyMode: this.bulkBuyMode,
            selectedCategories,
            quickTrip: this.quickTrip,
            quickTripDays: this.quickTripDays,
            dateRangeLabel,
        });

        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
