/**
 * MiseCommandMenu - Consolidated command menu for Mise
 * 
 * Single modal that lists all Mise commands as nice large buttons
 * grouped by category in a responsive grid layout
 */

import { Modal } from 'obsidian';
import type MisePlugin from '../../main';

interface CommandItem {
    label: string;
    icon: string;
    commandId: string;
}

interface CommandCategory {
    name: string;
    icon: string;
    commands: CommandItem[];
}

export class MiseCommandMenu extends Modal {
    private plugin: MisePlugin;

    constructor(plugin: MisePlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mise-command-menu');

        // Header
        const header = contentEl.createDiv('mise-menu-header');
        header.createEl('h2', { text: '🍽️ Mise Menu' });

        const categories: CommandCategory[] = [
            {
                name: 'Recipes',
                icon: '📚',
                commands: [
                    { label: 'Cookbook', icon: '📖', commandId: 'mise:open-cookbook' },
                    { label: 'Sidebar', icon: '📑', commandId: 'mise:open-cookbook-sidebar' },
                    { label: 'Import URL', icon: '📥', commandId: 'mise:import-recipe-from-url' },
                ]
            },
            {
                name: 'Meal Planning',
                icon: '📅',
                commands: [
                    { label: 'Calendar', icon: '🗓️', commandId: 'mise:open-meal-plan' },
                    { label: 'Shopping List', icon: '🛒', commandId: 'mise:generate-shopping-list' },
                ]
            },
            {
                name: 'Inventory',
                icon: '📦',
                commands: [
                    { label: 'Add Item', icon: '➕', commandId: 'mise:add-inventory-item' },
                    { label: 'Pantry Check', icon: '📋', commandId: 'mise:pantry-check' },
                    { label: 'Log Meal', icon: '✅', commandId: 'mise:log-meal' },
                ]
            },
            {
                name: 'Utilities',
                icon: '🔧',
                commands: [
                    { label: 'Export Index', icon: '📤', commandId: 'mise:export-recipe-index' },
                    { label: 'Settings', icon: '⚙️', commandId: '__settings__' },
                ]
            },
        ];

        const grid = contentEl.createDiv('mise-menu-grid');

        for (const category of categories) {
            const section = grid.createDiv('mise-menu-section');
            section.createEl('h3', { text: `${category.icon} ${category.name}` });

            const buttonsGrid = section.createDiv('mise-menu-buttons');
            // Set grid based on command count
            if (category.commands.length === 4) {
                buttonsGrid.addClass('mise-buttons-2x2');
            } else if (category.commands.length === 3) {
                buttonsGrid.addClass('mise-buttons-3');
            } else {
                buttonsGrid.addClass('mise-buttons-2');
            }

            for (const cmd of category.commands) {
                const btn = buttonsGrid.createDiv('mise-menu-btn');
                btn.createSpan({ cls: 'mise-menu-btn-icon', text: cmd.icon });
                btn.createSpan({ cls: 'mise-menu-btn-label', text: cmd.label });

                btn.onclick = () => {
                    this.close();
                    if (cmd.commandId === '__settings__') {
                        (this.app as any).setting.open();
                        (this.app as any).setting.openTabById('mise');
                    } else {
                        (this.app as any).commands.executeCommandById(cmd.commandId);
                    }
                };
            }
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
