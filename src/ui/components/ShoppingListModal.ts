/**
 * ShoppingListModal - Multi-step wizard for generating shopping lists
 * Steps: 1) Select time range  2) Select store  3) Select items (optional)
 */

import { App, Modal, Setting } from 'obsidian';
import { MiseSettings, StoreProfile, ShoppingItem } from '../../types';

type TimeRange = { type: 'week'; weekNumber: number; label: string } | { type: 'month'; label: string };

interface WeekInfo {
    weekNumber: number;
    startDate: string;
    endDate: string;
}

interface ShoppingListModalResult {
    timeRange: TimeRange;
    storeId: string | null;  // null = General
    selectedItems: ShoppingItem[] | null;  // null = all items
}

export class ShoppingListModal extends Modal {
    private settings: MiseSettings;
    private weeks: WeekInfo[];
    private allItems: ShoppingItem[];
    private onGenerate: (result: ShoppingListModalResult) => void;

    // State
    private step: 1 | 2 | 3 = 1;
    private selectedTimeRange: TimeRange | null = null;
    private selectedStoreId: string | null = null;
    private selectSpecificItems: boolean = false;
    private itemSelections: Map<string, boolean> = new Map();

    constructor(
        app: App,
        settings: MiseSettings,
        weeks: WeekInfo[],
        allItems: ShoppingItem[],
        onGenerate: (result: ShoppingListModalResult) => void
    ) {
        super(app);
        this.settings = settings;
        this.weeks = weeks;
        this.allItems = allItems;
        this.onGenerate = onGenerate;

        // Initialize all items as selected by default
        for (const item of allItems) {
            this.itemSelections.set(item.ingredient, true);
        }
    }

    onOpen() {
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
                this.renderStoreStep();
                break;
            case 3:
                this.renderItemsStep();
                break;
        }
    }

    private renderTimeRangeStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Select Time Range' });

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
                                label
                            };
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
                        this.selectedTimeRange = { type: 'month', label: 'Entire Month' };
                        this.renderStep();
                    });
            });

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const nextBtn = navDiv.createEl('button', { text: 'Next →' });
        nextBtn.disabled = !this.selectedTimeRange;
        nextBtn.onclick = () => {
            if (this.selectedTimeRange) {
                this.step = 2;
                this.renderStep();
            }
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
                    });
            });

        // Navigation
        const navDiv = contentEl.createDiv('mise-modal-nav');

        const backBtn = navDiv.createEl('button', { text: '← Back' });
        backBtn.onclick = () => {
            this.step = 1;
            this.renderStep();
        };

        const nextBtn = navDiv.createEl('button', {
            text: this.selectSpecificItems ? 'Next →' : 'Generate'
        });
        nextBtn.onclick = () => {
            if (this.selectSpecificItems) {
                this.step = 3;
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
            this.step = 2;
            this.renderStep();
        };

        const generateBtn = navDiv.createEl('button', { text: 'Generate' });
        generateBtn.onclick = () => this.complete();
    }

    private complete() {
        const selectedItems = this.selectSpecificItems
            ? this.allItems.filter(item => this.itemSelections.get(item.ingredient))
            : null;

        this.onGenerate({
            timeRange: this.selectedTimeRange!,
            storeId: this.selectedStoreId,
            selectedItems,
        });

        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
