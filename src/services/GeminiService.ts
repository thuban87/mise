/**
 * GeminiService - AI-powered cleanup for shopping lists
 * 
 * Uses Google's Gemini API to intelligently clean up and consolidate
 * generated shopping lists.
 */

import { requestUrl } from 'obsidian';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Cleanup prompt for Gemini
 */
const CLEANUP_SYSTEM_PROMPT = `Clean up this grocery shopping list. You are receiving parser output that may contain errors.

  ## CRITICAL CHECKS (Do these FIRST):

  1. Impossible Quantities Check:
     - Any spice/seasoning >1 cup? Check details section for "03 cup" pattern (means 0.3 cup or 3 tbsp)
     - Water >20 cups? Check details section for parsing errors (81 cups = 8.1 cups)
     - Beer >5 cups? Verify amount
     - Salt >0.25 cup? Check details section for errors

  2. Missing Ingredients Check:
     - Asian recipes without rice? Search original list for rice entries
     - Italian recipes without pasta? Verify pasta is not missing
     - Recipes with "to taste" salt/pepper but no measurable salt entry? OK to remove

  3. Details Section Review:
     - Look for patterns like "03 cup" - This means "0.3 cup" NOT "3 cups"
     - Look for "81 cups" - This is likely "8.1 cups" or "0.81 cups"
     - Verify aggregated totals make sense given the details

  ## CONSOLIDATION RULES:

  1. Combine these as duplicates:
     - "olive oil" = "extra virgin olive oil" = "extra-virgin olive oil"
     - "all-purpose flour" = "all purpose flour" = "All-purpose flour"
     - "grated Parmesan" = "freshly grated Parmesan"
     - "boneless skinless chicken breasts" (combine weight + count with note)

  2. Keep these SEPARATE:
     - Smoked paprika vs paprika
     - Salted butter vs unsalted butter
     - Sea salt vs kosher salt (unless used interchangeably in recipes)

  3. Meat with mixed units:
     - "1 lb boneless chicken" + "3 boneless chicken breasts"
     - Convert to: "~2 lbs boneless skinless chicken breasts (approximately 4-5 breasts)"

  ## CLEANUP ACTIONS:

  1. Remove entirely:
     - Items marked "to taste" (salt to taste, pepper to taste)
     - Instructions not ingredients ("for serving", "cooked rice for serving")
     - Conflicts marked with warning symbol where one has units and one does not - keep the one with units
     - All details sections

  2. Add context for vague items:
     - "4 Chicken" - Check details for cut type, add it
     - "15 garlic, minced" - Convert to "15 cloves garlic, minced"
     - "1 Italian parsley" - Convert to "1 bunch fresh Italian parsley"

  3. Fix malformed measurements:
     - "1 1/ tsp" - Check details for actual amount
     - "2 4, bone-in Chicken Breast Halves" - Convert to "8 bone-in chicken breast halves"

  ## EXAMPLES OF FIXES:

  WRONG: "3 1/4 cups salt" (from "03 cup" parser error)
  RIGHT: "~2 tbsp salt" (actual total from details)

  WRONG: "89 1/4 cups water" (from "81 cups" parser error)
  RIGHT: "~9 cups water" (corrected from details)

  WRONG: Missing rice entirely
  RIGHT: "White rice (enough for 4+ servings)"

  WRONG: "7 boneless chicken breasts" + "1 lb boneless chicken breasts" (duplicate)
  RIGHT: "~2 lbs boneless skinless chicken breasts (approximately 4-5 breasts)"

  ## OUTPUT FORMAT - CRITICAL:
  - Start IMMEDIATELY with the frontmatter (---)
  - Return ONLY the cleaned markdown list - NO preamble, NO "Here is..." text
  - Use the same category headers with emojis
  - Use checkbox format with - [ ]
  - Include helpful notes in parentheses
  - Organize within categories (oils together, spices together, etc.)
  
   ## INVENTORY CROSS-REFERENCE - SMART UNIT MATCHING

  **CRITICAL: The inventory data below is for REFERENCE ONLY. DO NOT modify it. DO NOT return it. ONLY return the
  shopping list.**

  If inventory data is provided:

  1. **Subtract inventory quantities from shopping list quantities:**
     - Shopping list needs "164 oz milk" but inventory has "164 oz milk" → Remove milk from list (satisfied)
     - Shopping list needs "100 oz milk" but inventory has "90 oz milk" → Show "10 oz milk needed (have 90 oz)"
     - Shopping list needs "50 oz chicken broth" but inventory has "32 oz chicken broth" → Show "18 oz chicken broth
  needed (have 32 oz)"

  2. **Unit matching and conversion rules:**

     ### SAFE CONVERSIONS (DO THESE):

     **Volume for liquids (milk, water, broth, juice, oil):**
     - 1 cup = 8 fluid oz = 16 tbsp = 48 tsp
     - Examples:
       - Need "12 cups milk", have "90 oz milk" → Need "6 oz milk" (12 cups = 96 oz, have 90)
       - Need "1 cup chicken broth", have "32 oz chicken broth" → Remove (have 4 cups)

     **Weight conversions:**
     - 1 lb = 16 oz = 453.6 g
     - Examples:
       - Need "2 lbs bacon", have "2 lb bacon" → Remove (same)
       - Need "32 oz ground beef", have "1 lb ground beef" → Need "16 oz ground beef" (1 lb = 16 oz, need 32)

     **Count matching (exact):**
     - "15 eggs" = "15 count egg" = "15 large eggs"
     - "7 banana" = "7 count banana" = "7 bananas"

     **Teaspoon/Tablespoon conversions:**
     - 1 tbsp = 3 tsp
     - Only for liquids, oils, and small amounts

     ### DO NOT CONVERT (Leave as-is if units don't match):

     ❌ **Dry goods weight ↔ volume:** "2 cups flour" vs "1 lb flour" → Different densities, don't convert
     ❌ **Count ↔ weight:** "3 chicken breasts" vs "2 lbs chicken" → Sizes vary, don't convert
     ❌ **Ambiguous items:** "1 package" vs "16 oz" → Package size varies
     ❌ **Cheese weight ↔ volume:** "2 cups cheese, shredded" vs "8 oz cheese" → Packing varies

  3. **Name matching rules (case-insensitive, flexible):**
     - "milk" matches "milk", "whole milk", "2% milk", "skim milk"
     - "chicken broth" matches "chicken broth", "chicken stock"
     - "boneless skinless chicken breasts" matches "chicken breasts"
     - "banana" matches "banana", "bananas"
     - "olive oil" matches "olive oil", "extra virgin olive oil"
     - When in doubt, match if core ingredient name is the same

  4. **When to remove items:**
     - If inventory quantity >= shopping list quantity (after conversion if applicable) → Remove item completely
     - Add a note at top: "✓ [X items] removed (already in inventory)"

  5. **When to adjust quantities:**
     - If inventory quantity < shopping list quantity → Show difference
     - Format: "[Needed amount] [ingredient] needed (have [inventory amount])"
     - Examples:
       - "10 oz milk needed (have 90 oz)"
       - "1 lb ground beef needed (have 1 lb - need 1 more lb)"

  6. **Items not in inventory:**
     - Leave unchanged on shopping list

  **EXAMPLE WITH CONVERSIONS:**

  Shopping List (before):
  - [ ] 12 cups milk
  - [ ] 32 oz chicken broth
  - [ ] 15 large eggs
  - [ ] 2 lbs ground beef
  - [ ] 3 lbs boneless skinless chicken breasts

  Inventory:
  - milk: 90 oz (= 11.25 cups)
  - chicken broth: 32 oz (= 4 cups)
  - egg: 15 count
  - ground beef: 1 lb (= 16 oz)
  - chicken breasts: 28 oz (can't convert - don't know how many breasts)

  Shopping List (after):
  > ✓ 2 items removed (already in inventory): chicken broth, eggs

  - [ ] 6 oz milk needed (have 90 oz, need 96 oz)
  - [ ] 16 oz ground beef needed (have 1 lb)
  - [ ] 3 lbs boneless skinless chicken breasts needed (have 28 oz - can't directly compare)

  **REMEMBER: When in doubt about a conversion, DON'T convert. It's better to show both and let the user decide.**

  ## ADDITIONAL CONSOLIDATION RULES:

  1. **Multiple entries of same ingredient with different preps:**
     - "1 cup onion, chopped" + "1 medium onion, sliced"
     - → "2 to 3 yellow onions (for various preparations)"

  2. **Same ingredient with mixed units:**
     - "2 cups cheese, shredded" + "1 lb cheese, shredded"
     - → Combine to weight: "~1.5 lbs cheese, shredded"

  3. **Missing amounts:**
     - "Taco seasoning" (no amount)
     - → Check details section, add amount or estimate based on servings

  4. **Avoid "various types":**
     - "BBQ sauce (various types)"
     - → Either pick dominant type or list separately

  5. **Unspecified ingredients:**
     - "Butter (unspecified)"
     - → Default to unsalted butter OR check recipe context`;

export interface GeminiCleanupResult {
    success: boolean;
    cleanedList?: string;
    error?: string;
    tokensUsed?: number;
}

export class GeminiService {
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
     * Clean up a shopping list using Gemini
     * @param rawMarkdown - The shopping list markdown to clean up
     * @param inventoryMarkdown - Optional current inventory to cross-reference
     */
    async cleanupShoppingList(rawMarkdown: string, inventoryMarkdown?: string): Promise<GeminiCleanupResult> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Gemini API key not configured',
            };
        }

        // Build the prompt text - include inventory if provided
        let promptText = `${CLEANUP_SYSTEM_PROMPT}\n\n---\n\nHere is the shopping list to clean up:\n\n${rawMarkdown}`;

        if (inventoryMarkdown) {
            promptText += `\n\n---\n\n## Current Inventory\n\nHere is my current kitchen inventory. Use this to adjust the shopping list:\n\n${inventoryMarkdown}`;
        }

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: promptText,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16384,
            },
        };

        // Log estimated input size (rough estimate: ~4 chars per token)
        const inputChars = promptText.length;
        const estimatedInputTokens = Math.round(inputChars / 4);
        console.log(`GeminiService: Request size: ${inputChars} chars (~${estimatedInputTokens} tokens)`);

        try {
            const response = await requestUrl({
                url: `${GEMINI_API_URL}?key=${this.apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                throw: false,  // Don't throw on non-200 so we can inspect the response
            });

            if (response.status !== 200) {
                // Try to parse error details
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

            // Extract the generated text
            const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                return {
                    success: false,
                    error: 'No response generated from Gemini',
                };
            }

            // Extract token usage if available
            const tokensUsed = data?.usageMetadata?.totalTokenCount;

            // Validate the response format (prevent inventory overwrite)
            const validation = this.validateShoppingListFormat(generatedText);
            if (!validation.valid) {
                console.error('GeminiService: Invalid response format:', validation.error);
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
            console.error('GeminiService: Error calling API:', error);
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
