/**
 * MiseStatusBar - Status bar notification center for Mise
 * 
 * Shows a persistent status bar item with:
 * - Blinking indicator when alerts are present
 * - Click to open dropdown with alert list
 * - Snooze functionality per item
 */

import { Menu, Notice } from 'obsidian';
import type MisePlugin from '../../main';
import { InventoryItem } from '../../types';

interface SnoozedAlert {
    until: number; // timestamp
    itemKey: string;
}

export class MiseStatusBar {
    private plugin: MisePlugin;
    private statusBarEl: HTMLElement;
    private snoozedAlerts: Map<string, number> = new Map(); // itemKey -> snooze until timestamp
    private alertCount: number = 0;
    private blinkInterval: number | null = null;

    constructor(plugin: MisePlugin) {
        this.plugin = plugin;
        this.statusBarEl = plugin.addStatusBarItem();
        this.statusBarEl.addClass('mise-status-bar');
        this.statusBarEl.onclick = () => this.showAlertMenu();

        // Load snoozed alerts from plugin data
        this.loadSnoozedAlerts();

        // Initial check and start periodic updates
        this.checkAlerts();

        // Check every 5 minutes
        plugin.registerInterval(
            window.setInterval(() => this.checkAlerts(), 5 * 60 * 1000)
        );
    }

    private async loadSnoozedAlerts() {
        const data = await this.plugin.loadData() || {};
        const snoozed = data.snoozedAlerts as SnoozedAlert[] || [];
        const now = Date.now();

        // Only load non-expired snoozes
        for (const s of snoozed) {
            if (s.until > now) {
                this.snoozedAlerts.set(s.itemKey, s.until);
            }
        }
    }

    private async saveSnoozedAlerts() {
        const data = await this.plugin.loadData() || {};
        const snoozed: SnoozedAlert[] = [];

        for (const [itemKey, until] of this.snoozedAlerts) {
            snoozed.push({ itemKey, until });
        }

        data.snoozedAlerts = snoozed;
        await this.plugin.saveData(data);
    }

    public async checkAlerts() {
        // Reload inventory to get fresh data
        await this.plugin.inventoryService.reload();
        const expiringItems = this.getExpiringItems();
        this.alertCount = expiringItems.length;
        this.updateDisplay();
    }

    private getExpiringItems(): InventoryItem[] {
        const items = this.plugin.inventoryService.getStock();
        const warningDays = this.plugin.settings.expirationWarningDays || 3;
        const now = new Date();
        const warningDate = new Date();
        warningDate.setDate(now.getDate() + warningDays);

        return items.filter(item => {
            // Skip items without expiration
            if (!item.expirationDate) return false;

            // Skip snoozed items
            const itemKey = this.getItemKey(item);
            const snoozedUntil = this.snoozedAlerts.get(itemKey);
            if (snoozedUntil && Date.now() < snoozedUntil) return false;

            // Check if expiring within warning window
            const expDate = new Date(item.expirationDate);
            return expDate <= warningDate;
        });
    }

    private getItemKey(item: InventoryItem): string {
        return `${item.category}:${item.name}`;
    }

    private updateDisplay() {
        if (this.alertCount === 0) {
            this.statusBarEl.setText('🍽️ Mise');
            this.statusBarEl.removeClass('mise-status-alert');
            this.stopBlinking();
        } else {
            this.statusBarEl.setText(`🍽️ Mise (${this.alertCount}⚠️)`);
            this.statusBarEl.addClass('mise-status-alert');
            this.startBlinking();
        }
    }

    private startBlinking() {
        if (this.blinkInterval) return;

        let visible = true;
        this.blinkInterval = window.setInterval(() => {
            visible = !visible;
            this.statusBarEl.style.opacity = visible ? '1' : '0.5';
        }, 1000) as unknown as number;
    }

    private stopBlinking() {
        if (this.blinkInterval) {
            window.clearInterval(this.blinkInterval);
            this.blinkInterval = null;
            this.statusBarEl.style.opacity = '1';
        }
    }

    private showAlertMenu() {
        const menu = new Menu();
        const expiringItems = this.getExpiringItems();

        if (expiringItems.length === 0) {
            menu.addItem(item => {
                item.setTitle('No alerts')
                    .setDisabled(true);
            });
        } else {
            // Add header
            menu.addItem(item => {
                item.setTitle(`⚠️ Expiring Soon (${expiringItems.length})`)
                    .setDisabled(true);
            });

            menu.addSeparator();

            for (const invItem of expiringItems) {
                const expDate = new Date(invItem.expirationDate!);
                const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const label = daysLeft <= 0
                    ? `${invItem.name} - EXPIRED!`
                    : `${invItem.name} - ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

                menu.addItem(item => {
                    item.setTitle(label)
                        .setIcon('alert-triangle');
                });

                // Snooze submenu
                menu.addItem(item => {
                    item.setTitle('  ↳ Snooze...')
                        .setIcon('clock')
                        .onClick(() => this.showSnoozeMenu(invItem));
                });
            }

            menu.addSeparator();

            // Clear all alerts option (snooze all for 1 week)
            if (expiringItems.length > 0) {
                menu.addItem(item => {
                    item.setTitle('✕ Clear All Alerts')
                        .setIcon('x')
                        .onClick(async () => {
                            for (const invItem of expiringItems) {
                                const itemKey = this.getItemKey(invItem);
                                this.snoozedAlerts.set(itemKey, Date.now() + 7 * 24 * 60 * 60 * 1000);
                            }
                            await this.saveSnoozedAlerts();
                            await this.checkAlerts();
                            new Notice('✅ All alerts cleared for 1 week');
                        });
                });

                menu.addSeparator();
            }

            // Quick actions
            menu.addItem(item => {
                item.setTitle('📦 Add Inventory Item')
                    .onClick(() => {
                        (this.plugin.app as any).commands.executeCommandById('mise:add-inventory-item');
                    });
            });

            menu.addItem(item => {
                item.setTitle('🍽️ Log Meal')
                    .onClick(() => {
                        (this.plugin.app as any).commands.executeCommandById('mise:log-meal');
                    });
            });

            menu.addItem(item => {
                item.setTitle('📋 Pantry Check')
                    .onClick(() => {
                        (this.plugin.app as any).commands.executeCommandById('mise:pantry-check');
                    });
            });

        }

        menu.showAtMouseEvent(new MouseEvent('click', {
            clientX: this.statusBarEl.getBoundingClientRect().left,
            clientY: this.statusBarEl.getBoundingClientRect().top - 10,
        }));
    }

    private showSnoozeMenu(item: InventoryItem) {
        const menu = new Menu();
        const itemKey = this.getItemKey(item);

        menu.addItem(menuItem => {
            menuItem.setTitle(`Snooze "${item.name}" for...`)
                .setDisabled(true);
        });

        menu.addSeparator();

        const snoozeOptions = [
            { label: '1 day', hours: 24 },
            { label: '3 days', hours: 72 },
            { label: '1 week', hours: 168 },
        ];

        for (const opt of snoozeOptions) {
            menu.addItem(menuItem => {
                menuItem.setTitle(opt.label)
                    .onClick(async () => {
                        const until = Date.now() + opt.hours * 60 * 60 * 1000;
                        this.snoozedAlerts.set(itemKey, until);
                        await this.saveSnoozedAlerts();
                        this.checkAlerts();
                        new Notice(`Snoozed "${item.name}" for ${opt.label}`);
                    });
            });
        }

        menu.showAtMouseEvent(new MouseEvent('click'));
    }

    public destroy() {
        this.stopBlinking();
    }
}
