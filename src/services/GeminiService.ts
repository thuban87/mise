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
     */
    async cleanupShoppingList(rawMarkdown: string): Promise<GeminiCleanupResult> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Gemini API key not configured',
            };
        }

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `${CLEANUP_SYSTEM_PROMPT}\n\n---\n\nHere is the shopping list to clean up:\n\n${rawMarkdown}`,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16384,
            },
        };

        // Debug: log request size
        const requestSize = JSON.stringify(requestBody).length;
        console.log(`GeminiService: Request size: ${requestSize} bytes (~${Math.round(requestSize / 4)} tokens)`);

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

            console.log(`GeminiService: Response status: ${response.status}`);
            console.log(`GeminiService: Response body: ${response.text.substring(0, 500)}`);

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
}
