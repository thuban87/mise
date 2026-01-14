/**
 * Folder Suggest Component
 * 
 * Provides autocomplete functionality for folder path inputs.
 * Based on Obsidian's suggest pattern.
 */

import {
    App,
    TFolder,
    AbstractInputSuggest,
} from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    private folders: TFolder[];
    private textInput: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.textInput = inputEl;
        this.folders = this.getFolders();
    }

    private getFolders(): TFolder[] {
        return this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    getSuggestions(query: string): TFolder[] {
        const lowerQuery = query.toLowerCase();
        return this.folders.filter(folder =>
            folder.path.toLowerCase().includes(lowerQuery)
        );
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.createEl('div', { text: folder.path, cls: 'mise-folder-suggestion' });
    }

    selectSuggestion(folder: TFolder): void {
        this.textInput.value = folder.path;
        this.textInput.trigger('input');
        this.close();
    }
}
