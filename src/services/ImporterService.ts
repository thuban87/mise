/**
 * ImporterService - Import recipes from URLs
 * 
 * Fetches web pages, extracts JSON-LD Recipe schema data,
 * and generates markdown files in the Mise recipe format.
 */

import { App, requestUrl, TFolder } from 'obsidian';
import { MiseSettings, RecipeCategory } from '../types';

/**
 * JSON-LD Recipe schema structure (subset of schema.org/Recipe)
 */
interface RecipeJsonLd {
    '@type': 'Recipe' | string[];
    name?: string;
    image?: string | string[] | { url: string }[];
    prepTime?: string;  // ISO 8601 duration (PT15M)
    cookTime?: string;
    totalTime?: string;
    recipeYield?: string | string[];
    recipeCategory?: string | string[];
    recipeCuisine?: string | string[];
    recipeIngredient?: string[];
    recipeInstructions?: string | string[] | HowToStep[];
    description?: string;
    nutrition?: {
        '@type'?: string;
        calories?: string;
        fatContent?: string;
        proteinContent?: string;
        carbohydrateContent?: string;
        fiberContent?: string;
    };
    author?: string | { name?: string };
    datePublished?: string;
}

interface HowToStep {
    '@type': 'HowToStep' | string;
    text?: string;
    name?: string;
}

interface HowToSection {
    '@type': 'HowToSection' | string;
    name?: string;
    text?: string;
    itemListElement?: (HowToStep | HowToSection | string)[];
}

type InstructionItem = string | HowToStep | HowToSection;

/**
 * Parsed recipe data ready for markdown generation
 */
export interface ParsedRecipe {
    title: string;
    description: string;
    image: string | null;
    prepTime: number | null;
    cookTime: number | null;
    servings: string;
    category: RecipeCategory;
    ingredients: string[];
    instructions: string[];
    source: string;
    nutrition?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        fiber?: number;
    };
}

export class ImporterService {
    private app: App;
    private settings: MiseSettings;

    constructor(app: App, settings: MiseSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Update settings reference (called when settings change)
     */
    updateSettings(settings: MiseSettings) {
        this.settings = settings;
    }

    /**
     * Main import workflow - fetch URL, parse, generate file
     */
    async importFromUrl(url: string, category: RecipeCategory): Promise<string> {
        console.log(`ImporterService: Importing from ${url}`);

        // Fetch the page
        const html = await this.fetchPage(url);

        // Extract JSON-LD
        const jsonLd = this.extractJsonLd(html);
        if (!jsonLd) {
            throw new Error('No recipe data found on this page. The site may not support structured data.');
        }

        // Parse into our format
        const parsed = this.parseRecipe(jsonLd, url, category);
        console.log(`ImporterService: Parsed recipe "${parsed.title}"`);

        // Handle image if downloading enabled
        let imagePath = parsed.image;

        if (parsed.image && this.settings.downloadImagesOnImport) {
            try {
                const downloaded = await this.downloadImage(parsed.image, parsed.title);
                if (downloaded) {
                    imagePath = downloaded;
                }
            } catch (e) {
                console.warn('ImporterService: Failed to download image', e);
                // Keep original URL
            }
        }

        // Generate markdown
        const markdown = this.generateMarkdown({ ...parsed, image: imagePath });

        // Create file
        const filePath = await this.createRecipeFile(parsed.title, markdown);
        console.log(`ImporterService: Created file at ${filePath}`);

        return filePath;
    }

    /**
     * Fetch HTML from URL using Obsidian's requestUrl (bypasses CORS)
     */
    async fetchPage(url: string): Promise<string> {
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ObsidianRecipeImporter/1.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: Failed to fetch page`);
            }

            return response.text;
        } catch (error: any) {
            console.error('ImporterService: Fetch error', error);
            throw new Error(`Failed to fetch URL: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Extract JSON-LD Recipe schema from HTML
     */
    extractJsonLd(html: string): RecipeJsonLd | null {
        // Find all JSON-LD script tags
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let match;

        while ((match = jsonLdRegex.exec(html)) !== null) {
            try {
                const content = match[1].trim();
                const data = JSON.parse(content);

                // Handle @graph array
                if (data['@graph'] && Array.isArray(data['@graph'])) {
                    for (const item of data['@graph']) {
                        if (this.isRecipeType(item)) {
                            return item as RecipeJsonLd;
                        }
                    }
                }

                // Direct Recipe object
                if (this.isRecipeType(data)) {
                    return data as RecipeJsonLd;
                }

                // Array of objects
                if (Array.isArray(data)) {
                    for (const item of data) {
                        if (this.isRecipeType(item)) {
                            return item as RecipeJsonLd;
                        }
                    }
                }
            } catch (e) {
                // Continue to next script tag
                console.debug('ImporterService: Failed to parse JSON-LD block', e);
            }
        }

        return null;
    }

    /**
     * Check if an object is a Recipe type
     */
    private isRecipeType(obj: any): boolean {
        if (!obj || typeof obj !== 'object') return false;
        const type = obj['@type'];
        if (typeof type === 'string') {
            return type === 'Recipe' || type.toLowerCase().includes('recipe');
        }
        if (Array.isArray(type)) {
            return type.some(t => t === 'Recipe' || t.toLowerCase().includes('recipe'));
        }
        return false;
    }

    /**
     * Parse JSON-LD into our internal format
     */
    parseRecipe(jsonLd: RecipeJsonLd, sourceUrl: string, category: RecipeCategory): ParsedRecipe {
        return {
            title: this.cleanString(jsonLd.name) || 'Untitled Recipe',
            description: this.cleanString(jsonLd.description) || '',
            image: this.extractImage(jsonLd.image),
            prepTime: this.parseDuration(jsonLd.prepTime),
            cookTime: this.parseDuration(jsonLd.cookTime),
            servings: this.extractServings(jsonLd.recipeYield),
            category,
            ingredients: this.extractIngredients(jsonLd.recipeIngredient),
            instructions: this.extractInstructions(jsonLd.recipeInstructions),
            source: sourceUrl,
            nutrition: this.extractNutrition(jsonLd.nutrition),
        };
    }

    /**
     * Parse ISO 8601 duration string to minutes
     * Examples: PT15M -> 15, PT1H30M -> 90, PT2H -> 120
     */
    parseDuration(duration?: string): number | null {
        if (!duration) return null;

        // Match ISO 8601 duration format
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
        if (!match) {
            // Try simple number
            const simpleNum = parseInt(duration, 10);
            return isNaN(simpleNum) ? null : simpleNum;
        }

        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);

        return hours * 60 + minutes + Math.round(seconds / 60);
    }

    /**
     * Extract image URL from various JSON-LD image formats
     * Handles: string, string[], {url}, {contentUrl}, ImageObject, etc.
     */
    private extractImage(image?: any): string | null {
        if (!image) {
            return null;
        }

        // Direct string URL
        if (typeof image === 'string') {
            return image;
        }

        // Single object with url or contentUrl
        if (typeof image === 'object' && !Array.isArray(image)) {
            const url = image.url || image.contentUrl || image['@id'];
            if (typeof url === 'string') {
                return url;
            }
        }

        // Array of images
        if (Array.isArray(image)) {
            for (const item of image) {
                // String in array
                if (typeof item === 'string') {
                    return item;
                }
                // Object in array
                if (item && typeof item === 'object') {
                    const url = item.url || item.contentUrl || item['@id'];
                    if (typeof url === 'string') {
                        return url;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract servings string
     */
    private extractServings(yield_?: string | string[]): string {
        if (!yield_) return '';

        if (typeof yield_ === 'string') {
            return yield_;
        }

        if (Array.isArray(yield_) && yield_.length > 0) {
            return yield_[0];
        }

        return '';
    }

    /**
     * Extract and clean ingredients array
     */
    private extractIngredients(ingredients?: string[]): string[] {
        if (!ingredients || !Array.isArray(ingredients)) return [];
        return ingredients.map(i => this.cleanString(i)).filter(Boolean);
    }

    /**
     * Extract instructions from various formats
     * Handles: strings, arrays, HowToStep, HowToSection with nested itemListElement
     */
    private extractInstructions(instructions?: string | InstructionItem[]): string[] {
        if (!instructions) return [];

        // Single string - split by newlines or numbered patterns
        if (typeof instructions === 'string') {
            return instructions
                .split(/\n+/)
                .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
                .filter(Boolean);
        }

        // Array of strings, HowToStep, or HowToSection objects
        if (Array.isArray(instructions)) {
            return this.flattenInstructions(instructions);
        }

        return [];
    }

    /**
     * Recursively flatten instruction items (handles HowToSection nesting)
     */
    private flattenInstructions(items: InstructionItem[]): string[] {
        const results: string[] = [];

        for (const item of items) {
            if (typeof item === 'string') {
                const cleaned = this.cleanString(item);
                if (cleaned) results.push(cleaned);
                continue;
            }

            if (!item || typeof item !== 'object') continue;

            const type = (item as any)['@type'];

            // HowToSection - recursively process its itemListElement
            if (type === 'HowToSection' || (typeof type === 'string' && type.includes('Section'))) {
                const section = item as HowToSection;
                // Add section name as a header if meaningful
                if (section.name && section.name.length > 3) {
                    results.push(`**${section.name}**`);
                }
                // Process nested items
                if (section.itemListElement && Array.isArray(section.itemListElement)) {
                    results.push(...this.flattenInstructions(section.itemListElement));
                }
                // Some sections have text directly
                if (section.text) {
                    const cleaned = this.cleanString(section.text);
                    if (cleaned) results.push(cleaned);
                }
                continue;
            }

            // HowToStep - extract text or name
            if (type === 'HowToStep' || (typeof type === 'string' && type.includes('Step'))) {
                const step = item as HowToStep;
                const text = this.cleanString(step.text || step.name || '');
                if (text) results.push(text);
                continue;
            }

            // Fallback: try to get text or name from unknown object
            const fallbackText = this.cleanString((item as any).text || (item as any).name || '');
            if (fallbackText) results.push(fallbackText);
        }

        return results;
    }

    /**
     * Extract nutrition information
     */
    private extractNutrition(nutrition?: RecipeJsonLd['nutrition']): ParsedRecipe['nutrition'] | undefined {
        if (!nutrition) return undefined;

        const extractNum = (val?: string): number | undefined => {
            if (!val) return undefined;
            const num = parseFloat(val.replace(/[^\d.]/g, ''));
            return isNaN(num) ? undefined : num;
        };

        const result = {
            calories: extractNum(nutrition.calories),
            protein: extractNum(nutrition.proteinContent),
            carbs: extractNum(nutrition.carbohydrateContent),
            fat: extractNum(nutrition.fatContent),
            fiber: extractNum(nutrition.fiberContent),
        };

        // Return undefined if all values are undefined
        if (Object.values(result).every(v => v === undefined)) {
            return undefined;
        }

        return result;
    }

    /**
     * Clean string - remove HTML, decode entities, trim
     */
    private cleanString(str?: string): string {
        if (!str) return '';

        return str
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Generate markdown content from parsed recipe
     */
    generateMarkdown(recipe: ParsedRecipe): string {
        const lines: string[] = [];

        // Frontmatter
        lines.push('---');
        lines.push(`category: ${recipe.category}`);
        lines.push('tags: []');
        lines.push('rating: ');
        lines.push(`servings: ${recipe.servings}`);
        if (recipe.prepTime !== null) {
            lines.push(`prepTime: ${recipe.prepTime}`);
        }
        if (recipe.cookTime !== null) {
            lines.push(`cookTime: ${recipe.cookTime}`);
        }
        lines.push(`source: ${recipe.source}`);
        if (recipe.image) {
            lines.push(`image: ${recipe.image}`);
        }
        lines.push('---');
        lines.push('');

        // Title
        lines.push(`# ${recipe.title}`);
        lines.push('');

        // Description
        if (recipe.description) {
            lines.push(recipe.description);
            lines.push('');
        }

        // Source link
        const domain = this.extractDomain(recipe.source);
        lines.push(`*Imported from [${domain}](${recipe.source})*`);
        lines.push('');

        // Ingredients
        lines.push('## 🥘 Ingredients');
        lines.push('');
        for (const ingredient of recipe.ingredients) {
            lines.push(`- ${ingredient}`);
        }
        lines.push('');

        // Instructions
        lines.push('## 📝 Instructions');
        lines.push('');
        recipe.instructions.forEach((step, index) => {
            lines.push(`${index + 1}. ${step}`);
        });
        lines.push('');

        // Nutrition (if available)
        if (recipe.nutrition) {
            lines.push('## 📊 Nutrition');
            lines.push('');
            if (recipe.nutrition.calories !== undefined) {
                lines.push(`- Calories: ${recipe.nutrition.calories}`);
            }
            if (recipe.nutrition.protein !== undefined) {
                lines.push(`- Protein: ${recipe.nutrition.protein}g`);
            }
            if (recipe.nutrition.carbs !== undefined) {
                lines.push(`- Carbs: ${recipe.nutrition.carbs}g`);
            }
            if (recipe.nutrition.fat !== undefined) {
                lines.push(`- Fat: ${recipe.nutrition.fat}g`);
            }
            if (recipe.nutrition.fiber !== undefined) {
                lines.push(`- Fiber: ${recipe.nutrition.fiber}g`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Extract domain from URL for display
     */
    private extractDomain(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }

    /**
     * Download image and save to vault
     */
    async downloadImage(imageUrl: string, recipeName: string): Promise<string | null> {
        try {
            const response = await requestUrl({
                url: imageUrl,
                method: 'GET',
            });

            if (response.status !== 200) {
                return null;
            }

            // Determine extension from content type or URL
            const contentType = response.headers['content-type'] || '';
            let ext = 'jpg';
            if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('gif')) ext = 'gif';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (imageUrl.match(/\.(png|gif|webp|jpeg|jpg)$/i)) {
                ext = imageUrl.match(/\.(png|gif|webp|jpeg|jpg)$/i)![1].toLowerCase();
                if (ext === 'jpeg') ext = 'jpg';
            }

            // Sanitize filename
            const safeName = recipeName
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 50);

            const fileName = `${safeName}.${ext}`;
            const folderPath = this.settings.importImageFolder;
            const filePath = `${folderPath}/${fileName}`;

            // Ensure folder exists
            await this.ensureFolder(folderPath);

            // Write file
            await this.app.vault.createBinary(filePath, response.arrayBuffer);

            return filePath;
        } catch (error) {
            console.error('ImporterService: Image download failed', error);
            return null;
        }
    }

    /**
     * Create recipe file in inbox folder
     */
    private async createRecipeFile(title: string, content: string): Promise<string> {
        const folderPath = this.settings.importInboxFolder;

        // Ensure folder exists
        await this.ensureFolder(folderPath);

        // Sanitize filename
        const safeName = title
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);

        const fileName = `${safeName}.md`;
        const filePath = `${folderPath}/${fileName}`;

        // Check if file exists
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // Add timestamp to make unique
            const ts = Date.now();
            const uniquePath = `${folderPath}/${safeName} (${ts}).md`;
            await this.app.vault.create(uniquePath, content);
            return uniquePath;
        }

        await this.app.vault.create(filePath, content);
        return filePath;
    }

    /**
     * Ensure folder exists, creating if necessary
     */
    private async ensureFolder(folderPath: string): Promise<void> {
        const existing = this.app.vault.getAbstractFileByPath(folderPath);
        if (existing instanceof TFolder) return;

        try {
            await this.app.vault.createFolder(folderPath);
        } catch (e) {
            // Folder might already exist
        }
    }
}
