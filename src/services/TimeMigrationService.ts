/**
 * TimeMigrationService
 * 
 * One-time migration utility to convert time strings in recipe frontmatter
 * to normalized integer minutes format.
 * 
 * Examples of conversions:
 *   "5 mins" → 5
 *   "1 hour 30 minutes" → 90
 *   "1h 30m" → 90
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { MiseSettings } from '../types';
import { parseTime } from '../parsers/FrontmatterParser';
import { PLUGIN_NAME } from '../utils/constants';

interface MigrationResult {
    totalFiles: number;
    migratedFiles: number;
    skippedFiles: number;
    errors: string[];
}

export class TimeMigrationService {
    private app: App;
    private settings: MiseSettings;

    constructor(app: App, settings: MiseSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Run the time migration on all recipe files
     */
    async migrateAll(): Promise<MigrationResult> {
        const result: MigrationResult = {
            totalFiles: 0,
            migratedFiles: 0,
            skippedFiles: 0,
            errors: [],
        };

        const folder = this.app.vault.getAbstractFileByPath(this.settings.recipesFolder);
        if (!folder || !(folder instanceof TFolder)) {
            new Notice(`${PLUGIN_NAME}: Recipes folder not found: ${this.settings.recipesFolder}`);
            return result;
        }

        const files = this.getMarkdownFilesRecursive(folder);
        result.totalFiles = files.length;

        new Notice(`${PLUGIN_NAME}: Migrating ${files.length} recipe files...`);

        for (const file of files) {
            try {
                const migrated = await this.migrateFile(file);
                if (migrated) {
                    result.migratedFiles++;
                } else {
                    result.skippedFiles++;
                }
            } catch (error) {
                const msg = `Error migrating ${file.path}: ${error}`;
                result.errors.push(msg);
                console.error(`${PLUGIN_NAME}: ${msg}`);
            }
        }

        // Show summary
        const summary = `Migration complete: ${result.migratedFiles} updated, ${result.skippedFiles} unchanged, ${result.errors.length} errors`;
        new Notice(`${PLUGIN_NAME}: ${summary}`);
        console.log(`${PLUGIN_NAME}: ${summary}`);

        if (result.errors.length > 0) {
            console.log(`${PLUGIN_NAME}: Errors:`, result.errors);
        }

        return result;
    }

    /**
     * Migrate a single file's time fields
     * Returns true if file was modified, false if no changes needed
     */
    private async migrateFile(file: TFile): Promise<boolean> {
        const content = await this.app.vault.read(file);

        // Check if file has frontmatter
        if (!content.startsWith('---')) {
            return false;
        }

        // Find frontmatter boundaries
        const endIndex = content.indexOf('---', 3);
        if (endIndex === -1) {
            return false;
        }

        const frontmatter = content.slice(4, endIndex);
        const body = content.slice(endIndex + 3);

        let modified = false;
        const lines = frontmatter.split('\n');
        const newLines: string[] = [];

        for (const line of lines) {
            // Check for prep_time or cook_time fields
            const prepMatch = line.match(/^(prep_time:\s*)(.+)$/);
            const cookMatch = line.match(/^(cook_time:\s*)(.+)$/);

            if (prepMatch) {
                const newLine = this.migrateLine(prepMatch[1], prepMatch[2]);
                if (newLine !== line) {
                    modified = true;
                }
                newLines.push(newLine);
            } else if (cookMatch) {
                const newLine = this.migrateLine(cookMatch[1], cookMatch[2]);
                if (newLine !== line) {
                    modified = true;
                }
                newLines.push(newLine);
            } else {
                newLines.push(line);
            }
        }

        if (modified) {
            const newContent = `---\n${newLines.join('\n')}---${body}`;
            await this.app.vault.modify(file, newContent);
        }

        return modified;
    }

    /**
     * Migrate a single time line
     */
    private migrateLine(prefix: string, value: string): string {
        const trimmed = value.trim();

        // Already a pure number - no change needed
        if (/^\d+$/.test(trimmed)) {
            return `${prefix}${trimmed}`;
        }

        // Parse the time string
        const minutes = parseTime(trimmed);

        if (minutes === null) {
            // Can't parse, leave as-is
            return `${prefix}${trimmed}`;
        }

        return `${prefix}${minutes}`;
    }

    /**
     * Recursively get all markdown files in a folder
     */
    private getMarkdownFilesRecursive(folder: TFolder): TFile[] {
        const files: TFile[] = [];

        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getMarkdownFilesRecursive(child));
            }
        }

        return files;
    }

    /**
     * Preview migration without making changes
     */
    async previewMigration(): Promise<{ file: string; changes: string[] }[]> {
        const previews: { file: string; changes: string[] }[] = [];

        const folder = this.app.vault.getAbstractFileByPath(this.settings.recipesFolder);
        if (!folder || !(folder instanceof TFolder)) {
            return previews;
        }

        const files = this.getMarkdownFilesRecursive(folder);

        for (const file of files) {
            const content = await this.app.vault.read(file);

            if (!content.startsWith('---')) continue;

            const endIndex = content.indexOf('---', 3);
            if (endIndex === -1) continue;

            const frontmatter = content.slice(4, endIndex);
            const changes: string[] = [];

            for (const line of frontmatter.split('\n')) {
                const prepMatch = line.match(/^(prep_time:\s*)(.+)$/);
                const cookMatch = line.match(/^(cook_time:\s*)(.+)$/);

                const match = prepMatch || cookMatch;
                if (match) {
                    const trimmed = match[2].trim();
                    if (!/^\d+$/.test(trimmed)) {
                        const minutes = parseTime(trimmed);
                        if (minutes !== null) {
                            changes.push(`${match[1]}${trimmed} → ${minutes}`);
                        }
                    }
                }
            }

            if (changes.length > 0) {
                previews.push({ file: file.path, changes });
            }
        }

        return previews;
    }
}
