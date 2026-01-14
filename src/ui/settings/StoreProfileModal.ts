import { App, Modal, Setting, TextComponent, TextAreaComponent } from 'obsidian';
import { StoreProfile, StoreAisleMapping } from '../../types';

export class StoreProfileModal extends Modal {
    profile: StoreProfile;
    onSave: (profile: StoreProfile) => void;

    constructor(
        app: App,
        profile: StoreProfile | null,
        onSave: (profile: StoreProfile) => void
    ) {
        super(app);

        // Start with existing profile or default template
        this.profile = profile ? JSON.parse(JSON.stringify(profile)) : {
            id: crypto.randomUUID(),
            name: '',
            isDefault: false,
            aisles: []
        };

        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        // Apply class to the modal container itself to control width ('Outside' of modal)
        this.modalEl.addClass('mise-modal-wide');

        contentEl.empty();
        contentEl.addClass('mise-store-profile-modal');

        contentEl.createEl('h2', { text: this.profile.name ? `Edit Profile: ${this.profile.name}` : 'New Store Profile' });

        this.renderBasicSettings(contentEl);
        this.renderAisles(contentEl);
        this.renderFooter(contentEl);
    }

    renderBasicSettings(container: HTMLElement) {
        new Setting(container)
            .setName('Store Name')
            .setDesc('E.g. "Jewel-Osco", "Whole Foods"')
            .addText(text => text
                .setValue(this.profile.name)
                .onChange(value => {
                    this.profile.name = value;
                }));

        new Setting(container)
            .setName('Default Profile')
            .setDesc('Use this store by default if no other is selected.')
            .addToggle(toggle => toggle
                .setValue(this.profile.isDefault)
                .onChange(value => {
                    this.profile.isDefault = value;
                }));
    }

    renderAisles(container: HTMLElement) {
        container.createEl('h3', { text: 'Aisles Configuration' });

        const aislesContainer = container.createDiv('mise-aisles-container');

        // Render existing aisles
        this.profile.aisles.forEach((aisle, index) => {
            this.renderAisleItem(aislesContainer, aisle, index);
        });

        // Add Aisle Button
        const addBtnContainer = container.createDiv('mise-add-aisle-btn');
        const addBtn = addBtnContainer.createEl('button', { text: '+ Add Aisle' });
        addBtn.onclick = () => {
            this.profile.aisles.push({
                aisleName: '',
                aisleNumber: '',
                keywords: []
            });
            this.onOpen(); // Re-render
        };
    }

    renderAisleItem(container: HTMLElement, aisle: StoreAisleMapping, index: number) {
        const aisleDiv = container.createDiv('mise-aisle-item');
        aisleDiv.addClass('mise-card');

        // Header: Number | Name | Delete
        const headerDiv = aisleDiv.createDiv('mise-aisle-header');

        // Aisle Number
        new Setting(headerDiv)
            .setClass('mise-aisle-number-setting')
            .addText(text => text
                .setPlaceholder('8')
                .setValue(aisle.aisleNumber)
                .onChange(val => aisle.aisleNumber = val));

        // Aisle Name
        new Setting(headerDiv)
            .setClass('mise-aisle-name-setting')
            .addText(text => text
                .setPlaceholder('Spices 🥫')
                .setValue(aisle.aisleName)
                .onChange(val => aisle.aisleName = val));

        // Delete button
        const deleteBtn = headerDiv.createEl('div', { text: '🗑️' });
        deleteBtn.addClass('mise-aisle-delete-btn');
        deleteBtn.onclick = () => {
            this.profile.aisles.splice(index, 1);
            this.onOpen();
        };

        // Keywords
        const keywordsDiv = aisleDiv.createDiv('mise-aisle-keywords');
        keywordsDiv.createEl('span', { text: 'Keywords (comma separated):' });
        const textArea = new TextAreaComponent(keywordsDiv);
        textArea
            .setValue(aisle.keywords.join(', '))
            .setPlaceholder('cumin, paprika, salt, pepper...')
            .onChange(val => {
                aisle.keywords = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
            });
        textArea.inputEl.rows = 2;
        textArea.inputEl.style.width = '100%';
    }

    renderFooter(container: HTMLElement) {
        const footer = container.createDiv('mise-modal-footer');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.marginTop = '20px';
        footer.style.gap = '10px';

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = footer.createEl('button', { text: 'Save Profile' });
        saveBtn.addClass('mod-cta');
        saveBtn.onclick = () => {
            if (!this.profile.name) {
                // simple validation
                return;
            }
            this.onSave(this.profile);
            this.close();
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}
