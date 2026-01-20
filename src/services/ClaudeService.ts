/**
 * ClaudeService - AI-powered cleanup for shopping lists using Claude
 * 
 * Uses Anthropic's Claude API (Haiku model) to intelligently clean up and consolidate
 * generated shopping lists.
 */

import { requestUrl } from 'obsidian';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

/**
 * Cleanup prompt for Claude
 * TODO: Replace this placeholder with your custom prompt
 */
const CLAUDE_CLEANUP_PROMPT = `You are a helpful assistant that cleans up grocery shopping lists.

Clean up the provided shopping list by:
- Consolidating duplicate items
- Fixing obvious parsing errors
- Organizing items by category
- Using checkbox format (- [ ])

Return ONLY the cleaned shopping list in markdown format, starting with frontmatter (---).`;

export interface ClaudeCleanupResult {
    success: boolean;
    cleanedList?: string;
    error?: string;
    tokensUsed?: number;
}

export class ClaudeService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Check if the service is configured
     */
    isConfigured(): boolean {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Clean up a shopping list using Claude
     * @param rawMarkdown - The shopping list markdown to clean up
     * @param inventoryMarkdown - Optional current inventory to cross-reference
     */
    async cleanupShoppingList(rawMarkdown: string, inventoryMarkdown?: string): Promise<ClaudeCleanupResult> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Claude API key not configured',
            };
        }

        // Build the prompt text - include inventory if provided
        let userMessage = `Here is the shopping list to clean up:\n\n${rawMarkdown}`;

        if (inventoryMarkdown) {
            userMessage += `\n\n---\n\n## Current Inventory\n\nHere is my current kitchen inventory. Use this to adjust the shopping list:\n\n${inventoryMarkdown}`;
        }

        const requestBody = {
            model: CLAUDE_MODEL,
            max_tokens: 16384,
            messages: [
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
            system: CLAUDE_CLEANUP_PROMPT,
        };

        // Log estimated input size (rough estimate: ~4 chars per token)
        const inputChars = CLAUDE_CLEANUP_PROMPT.length + userMessage.length;
        const estimatedInputTokens = Math.round(inputChars / 4);
        console.log(`ClaudeService: Request size: ${inputChars} chars (~${estimatedInputTokens} tokens)`);

        try {
            const response = await requestUrl({
                url: CLAUDE_API_URL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(requestBody),
                throw: false,
            });

            if (response.status !== 200) {
                let errorDetail = response.text;
                try {
                    const errorJson = JSON.parse(response.text);
                    errorDetail = errorJson?.error?.message || response.text;
                } catch { /* ignore parse errors */ }

                return {
                    success: false,
                    error: `API error ${response.status}: ${errorDetail}`,
                };
            }

            const data = response.json;

            // Extract the generated text from Claude's response format
            const generatedText = data?.content?.[0]?.text;

            if (!generatedText) {
                return {
                    success: false,
                    error: 'No response generated from Claude',
                };
            }

            // Extract token usage
            const tokensUsed = (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0);

            // Validate the response format (prevent inventory overwrite)
            const validation = this.validateShoppingListFormat(generatedText);
            if (!validation.valid) {
                console.error('ClaudeService: Invalid response format:', validation.error);
                return {
                    success: false,
                    error: `Invalid response format: ${validation.error}`,
                };
            }

            return {
                success: true,
                cleanedList: generatedText.trim(),
                tokensUsed,
            };
        } catch (error) {
            console.error('ClaudeService: Error calling API:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Validate that the returned content is a shopping list, not inventory
     * This is a safety check to prevent accidental inventory file overwrite
     */
    private validateShoppingListFormat(content: string): { valid: boolean; error?: string } {
        const trimmed = content.trim();

        // Must start with frontmatter
        if (!trimmed.startsWith('---')) {
            return { valid: false, error: 'Response does not start with frontmatter' };
        }

        // Must contain shopping list category headers (at least one)
        const shoppingListHeaders = [
            '## 🥬 Produce',
            '## 🥩 Meat',
            '## 🥛 Dairy',
            '## 🍞 Bakery',
            '## 🥫 Pantry',
            '## 📦 Other',
            '## 🧊 Frozen'
        ];

        const hasShoppingHeaders = shoppingListHeaders.some(header => trimmed.includes(header));
        if (!hasShoppingHeaders) {
            return { valid: false, error: 'Response does not contain shopping list category headers' };
        }

        // Must NOT contain inventory table structure
        const inventoryPatterns = [
            '## Pantry\n\n| Item | Qty | Unit |',
            '## Fridge\n\n| Item | Qty | Unit |',
            '## Freezer\n\n| Item | Qty | Unit |',
            '| Purchased |',
            '| Expires |',
            '| Expiry Type |'
        ];

        const hasInventoryStructure = inventoryPatterns.some(pattern => trimmed.includes(pattern));
        if (hasInventoryStructure) {
            return { valid: false, error: 'Response contains inventory table structure - refusing to overwrite' };
        }

        // Must contain checkbox items (shopping list format)
        if (!trimmed.includes('- [ ]')) {
            return { valid: false, error: 'Response does not contain any shopping list items (- [ ])' };
        }

        return { valid: true };
    }
}
