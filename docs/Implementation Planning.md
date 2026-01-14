# Mise: Implementation Planning

## 1. Problem Statement & Solution
### The Problem
The current recipe system in the Obsidian vault has reached a "tipping point." With over 150 recipes, the manual effort required to maintain the index, plan meals, and generate shopping lists is beginning to outweigh the benefits of the digital system. Relying on external Python scripts and manual Dataview queries creates friction, making it difficult to answer simple questions like "What can I cook with what's in my fridge?" or "What's the total grocery list for this week?"

### The Solution: Mise
**Mise** (short for *Mise en place*—"everything in its place") is an Obsidian plugin designed to transform a folder of Markdown recipes into a fully integrated culinary operating system. It replaces manual scripts with real-time background indexing, replaces static tables with a visual "App-like" recipe browser, and automates the tedious translation of meal plans into shopping lists.

---

## 2. Current System Breakdown
The existing system relies on a distributed set of files and scripts:

*   **Storage:** ~150+ Markdown files located in `Life/Household/Kitchen/Recipes/`, categorized by subfolders (Beef, Chicken, Pasta, etc.).
*   **Metadata:** Recipes use YAML frontmatter for `category`, `tags`, `rating`, `prep_time`, and `cook_time`.
*   **Data Structure:** Ingredients are listed under a `## Ingredients` header, often using Markdown task lists (`- [ ]`).
*   **Indexing:** An external Python script (`System/Scripts/index_recipes.py`) crawls the directory and generates a `Recipe_Index.json` file.
*   **Discovery:** A "Cookbook" dashboard (`Life/Household/Kitchen/Cookbook.md`) uses Dataview to render tables and grids based on the JSON index and file metadata.
*   **Planning:** A manual Markdown file (`Life/Household/Kitchen/Meal Planning.md`) where meals are typed out by hand, often requiring the user to look up recipes in one file and type ingredients into another.

---

## 3. Phased Roadmap

### Phase 1: Foundation & Configuration
*   **Goal:** Establish a compiling plugin skeleton with a settings menu.
*   **Key Tasks:** Manifest setup, TypeScript configuration, and path settings for Recipes, Meal Plans, and Grocery notes.

### Phase 2: The "Silent" Indexer (Backend)
*   **Goal:** Replace the Python script with a native background service.
*   **Key Tasks:** File system watchers, real-time metadata caching, and an internal memory-store for recipes.

### Phase 3: The Ingredient Parser
*   **Goal:** Teach the plugin to "read" recipe contents.
*   **Key Tasks:** Robust header detection and bullet-point extraction to identify ingredients within the Markdown body.

### Phase 4: The Grid View (UI Skeleton)
*   **Goal:** Open a dedicated view for the "Cookbook."
*   **Key Tasks:** Creating an Obsidian ItemView and mounting a modern UI framework (React/Svelte) root.

### Phase 5: The Recipe Card
*   **Goal:** Visual excellence in recipe discovery.
*   **Key Tasks:** CSS styling for cards, handling banner images, and displaying star ratings/time at a glance.

### Phase 6: Search & Filter Logic
*   **Goal:** Instant, fuzzy-searchable recipe discovery.
*   **Key Tasks:** Implementing real-time filters for ingredients, categories, and ratings within the UI.

### Phase 7: Meal Plan Reader
*   **Goal:** Connect the plugin to the existing planning note.
*   **Key Tasks:** Parsing `Meal Planning.md` to identify existing scheduled meals and dates.

### Phase 8: Drag-and-Drop Assignment
*   **Goal:** Tactile meal planning.
*   **Key Tasks:** Dragging recipe cards into "Day Zones" to automatically append wikilinks to the Meal Planning note.

### Phase 9: The Ingredient Aggregator
*   **Goal:** The math behind the shopping list.
*   **Key Tasks:** Combining ingredient lists from all planned recipes for a specific date range.

### Phase 10: Shopping List Writer
*   **Goal:** Automated grocery list generation.
*   **Key Tasks:** Formatting the aggregated data into a categorized checklist in `00-Grocery.md`.

### Phase 11: Web Importer
*   **Goal:** Frictionless recipe capture.
*   **Key Tasks:** Scraper logic to convert recipe URLs into formatted Markdown files.

### Phase 12: Polish & Error Handling
*   **Goal:** Production readiness.
*   **Key Tasks:** Robust error boundaries for malformed files, UI/UX refinements, and theme compatibility.

### Phase 13: Final Testing & V1.0 Release
*   **Goal:** Stable deployment.
*   **Key Tasks:** End-to-end testing of the "strangler fig" migration to ensure no data loss.

---

## 4. Phase Details

### Phase 1: Foundation & Configuration
**Purpose:**
To establish a stable development environment, create the plugin "skeleton," and implement the settings interface. This ensures the plugin enables correctly within Obsidian and allows the user to define where their kitchen data lives.

**Implementation Steps:**
1.  **Project Initialization:**
    *   Initialize `npm` project and configure TypeScript (`tsconfig.json`).
    *   Set up build pipeline (Esbuild recommended for speed).
    *   Create standard Obsidian files: `manifest.json` and `main.ts`.
2.  **Plugin Class Structure:**
    *   Create `MisePlugin` class extending `Plugin`.
    *   Implement `onload` and `onunload` lifecycle methods.
3.  **Settings Interface:**
    *   Create `MiseSettingsTab` class extending `PluginSettingTab`.
    *   Define the `MiseSettings` interface with:
        *   `recipesFolder`: string (Default: `Life/Household/Kitchen/Recipes`)
        *   `mealPlanNote`: string (Default: `Life/Household/Kitchen/Meal Planning.md`)
        *   `groceryListNote`: string (Default: `Life/Household/Kitchen/Shopping Lists/00-Grocery.md`)
    *   Implement UI inputs (text fields) for these settings with `saveData` callbacks.

**Testing Procedures:**
1.  **Load Test:** Build the plugin, reload Obsidian, and verify "Mise" appears in the Community Plugins list.
2.  **Console Test:** Verify "Mise loaded" appears in the Developer Console.
3.  **Settings Persistence:**
    *   Open Settings > Mise.
    *   Change the `recipesFolder` path.
    *   Reload Obsidian.
    *   Return to Settings and verify the new path is still there.

### Phase 2: The "Silent" Indexer (Backend)
**Purpose:**
To replace the external Python script (`index_recipes.py`) with a native, real-time background service. This creates the "brain" of the plugin, maintaining an up-to-date in-memory list of recipes without requiring manual updates.

**Implementation Steps:**
1.  **Data Structures:**
    *   Define `Recipe` interface:
        ```typescript
        interface Recipe {
            path: string;
            title: string;
            folder: string; // e.g., "Chicken"
            frontmatter: Record<string, any>;
        }
        ```
2.  **RecipeIndex Class:**
    *   Create a singleton class `RecipeIndex`.
    *   Implement `scanVault()`: Iterates through `this.app.vault.getMarkdownFiles()` and filters by the `recipesFolder` setting.
3.  **Event Listeners:**
    *   Hook into `this.app.vault.on('create', ...)`
    *   Hook into `this.app.vault.on('modify', ...)`
    *   Hook into `this.app.vault.on('delete', ...)`
    *   On these events, update the internal `Recipe` array appropriately.
4.  **Metadata Extraction:**
    *   Use `this.app.metadataCache.getFileCache(file)` to retrieve frontmatter (tags, rating, time) immediately upon indexing.

**Testing Procedures:**
1.  **Initial Scan:** On plugin load, console log the number of recipes found. Verify it matches the actual file count (~150).
2.  **Create Test:** Create a new dummy file `TestRecipe.md` in the recipes folder. Verify console logs "Added TestRecipe".
3.  **Modify Test:** Change the frontmatter of an existing recipe. Verify console logs "Updated [Recipe Name]".
4.  **Delete Test:** Delete the dummy file. Verify console logs "Removed TestRecipe".

### Phase 3: The Ingredient Parser
**Purpose:**
To extract the actual culinary content (ingredients) from the Markdown body. This goes beyond simple metadata to understanding the "recipe" itself, enabling future features like shopping list aggregation and ingredient-based searching.

**Implementation Steps:**
1.  **Content Reading:**
    *   Extend `RecipeIndex` to read the file content using `this.app.vault.read(file)`.
    *   *Optimisation Note:* Only read content when necessary (e.g., initial scan or specific file modification), not on every minor event.
2.  **Regex Parsing Logic:**
    *   Identify the `## Ingredients` section (case-insensitive, handling various header levels if needed).
    *   Extract lines between `## Ingredients` and the next header (e.g., `## Instructions`).
3.  **Line Cleaning:**
    *   Filter out empty lines.
    *   Strip Markdown list syntax (bullets `-`, `*`, numbered lists `1.`).
    *   Strip checkbox syntax (`[ ]`, `[x]`).
    *   Store the clean ingredient strings in the `Recipe` object: `ingredients: string[]`.
4.  **Error Handling:**
    *   Handle cases where the `## Ingredients` header is missing gracefully (log a warning, but don't crash).

**Testing Procedures:**
1.  **Standard Test:** Create a recipe with a standard `## Ingredients` list. Verify the index correctly stores an array of ingredient strings.
2.  **Formatting Test:** Test with various list styles (bullets vs. numbers vs. tasks). Verify they all parse to clean text.
3.  **Missing Header Test:** Create a file without an Ingredients section. Verify the plugin records 0 ingredients but indexes the file successfully.

### Phase 4: The Grid View (UI Skeleton)
**Purpose:**
To create the visual "container" for the Mise application. This phase moves away from backend logic to creating the first user-facing interface: a dedicated tab in the Obsidian workspace that will eventually hold the cookbook.

**Implementation Steps:**
1.  **View Definition:**
    *   Create `MiseView` class extending `ItemView`.
    *   Register the view type constant (e.g., `MISE_VIEW_TYPE`).
2.  **Workspace Integration:**
    *   Add a ribbon icon (chef hat or utensil) that activates the view.
    *   Implement `activateView` logic in `main.ts` to open the leaf if not already open.
3.  **React/Svelte Mounting:**
    *   Choose a framework (React is standard in Obsidian dev).
    *   Create a root `Container.tsx` component.
    *   Mount this component into `this.containerEl` inside the `onOpen` method of `MiseView`.
4.  **Basic Data Binding:**
    *   Pass the `RecipeIndex` (from Phase 2) as a prop to the React container.
    *   Render a simple text list `<ul>` of recipe titles to prove the UI is connected to the data.

**Testing Procedures:**
1.  **Ribbon Click:** Click the new ribbon icon. Verify a new tab opens with the title "Mise Cookbook" (or similar).
2.  **Persistence:** Close and reopen Obsidian. Verify the view restores correctly if it was left open.
3.  **Data Flow:** Add a new recipe file. Verify the simple text list in the UI updates automatically (proving the reactivity chain works).

### Phase 5: The Recipe Card
**Purpose:**
To transform the basic text list into a visually engaging "cookbook" experience. This phase focuses on CSS styling and component design to display key recipe info (images, rating, time) at a glance, replacing the static Dataview tables.

**Implementation Steps:**
1.  **Component Design:**
    *   Create a `RecipeCard` React component.
    *   Structure: Image Banner (top), Title (middle), Metadata Footer (Rating + Time).
2.  **Image Handling:**
    *   Extract image links from frontmatter (if present) or finding the first image link `![[]]` in the file body.
    *   Resolve Obsidian internal links to displayable URLs using `app.vault.adapter.getResourcePath`.
3.  **CSS Styling:**
    *   Implement a grid layout (CSS Grid) for the main container.
    *   Style cards with rounded corners, shadows, and hover effects.
    *   *Constraint:* Ensure compatibility with Light and Dark modes using Obsidian's CSS variables (e.g., `--background-secondary`).
4.  **Metadata Display:**
    *   Convert numeric rating (1-5) to star icons (⭐️⭐️⭐️⭐️).
    *   Format time (e.g., "Prep: 15m").

**Testing Procedures:**
1.  **Visual Check:** Open the view. Do the cards look like cards?
2.  **Image Rendering:** Verify that recipes with local images display them correctly. Verify fallbacks for recipes without images (e.g., a placeholder icon).
3.  **Responsiveness:** Resize the Obsidian window. Verify the grid adapts (e.g., 3 columns -> 2 columns -> 1 column).

### Phase 6: Search & Filter Logic
**Purpose:**
To provide instant, intuitive access to the recipe collection. This phase implements the "fuzzy" logic that makes finding "that one spicy chicken dish" fast and easy, significantly improving upon the static folder structure.

**Implementation Steps:**
1.  **Search Logic (Fuzzy):**
    *   Import a lightweight fuzzy search library (like `fuzzysort` or simple includes check).
    *   Index recipe titles and ingredient lists.
2.  **Filter UI:**
    *   Add a "Search Bar" at the top of the View.
    *   Add a "Sort By" dropdown (Rating, Time, Alphabetical).
    *   Add a "Tag Filter" multiselect (e.g., "Chicken", "Quick", "Dinner").
3.  **State Management:**
    *   Connect UI inputs to a React state object (e.g., `filterState`).
    *   Create a derived array: `visibleRecipes = allRecipes.filter(...)`.
4.  **Performance Check:**
    *   Ensure typing in the search bar feels instant (debounce if necessary, though <200 items should be instant).

**Testing Procedures:**
1.  **Title Search:** Type "Chicken". Verify only chicken recipes appear.
2.  **Ingredient Search:** Type an ingredient (e.g., "Basil"). Verify recipes containing basil appear, even if "Basil" isn't in the title.
3.  **Sort Order:** Click "Sort by Rating". Verify 5-star recipes move to the top.
4.  **Empty State:** Type a nonsense string "Xylophone". Verify the UI shows a friendly "No recipes found" message instead of crashing.

### Phase 7: Meal Plan Reader
**Purpose:**
To bridge the gap between "Recipe" and "Plan." This phase teaches the plugin to understand the user's existing calendar-based planning system, enabling the UI to display which recipes are already scheduled for the week.

**Implementation Steps:**
1.  **File Parsing:**
    *   Locate the `mealPlanNote` (from Settings).
    *   Read the file content.
2.  **Structure Identification:**
    *   Identify Date Headers or Day Names (e.g., "Monday", "2026-01-06").
    *   Identify Lists under those headers.
    *   Parse wikilinks `[[Recipe Name]]` within those lists.
3.  **State Mapping:**
    *   Create a `MealPlan` state object: `{ "Monday": ["Recipe A"], "Tuesday": ["Recipe B"] }`.
    *   Update this state whenever the file changes (`vault.on('modify')`).
4.  **UI Indicator:**
    *   Update `RecipeCard` to show a small badge (e.g., "Planned: Mon") if the recipe is currently in the plan.

**Testing Procedures:**
1.  **Read Test:** Manually add `[[Chicken Parm]]` to Monday in the markdown file. Verify the plugin console logs "Monday contains Chicken Parm".
2.  **Update Test:** Remove the link from the file. Verify the plugin state clears for Monday.
3.  **Visual Test:** Verify the "Chicken Parm" card in the Grid View now has a visible indicator that it is on the menu.

### Phase 8: Drag-and-Drop Assignment
**Purpose:**
To transform meal planning from a typing exercise into a tactile, visual workflow. This phase implements the "drag" interaction that allows users to assign recipes to days without touching the markdown file directly.

**Implementation Steps:**
1.  **Drag Source:**
    *   Make `RecipeCard` draggable using HTML5 Drag and Drop API.
    *   Attach data payload: `event.dataTransfer.setData("recipePath", path)`.
2.  **Drop Targets:**
    *   Create a "Week View" sidebar or panel in the Grid View.
    *   Create drop zones for each day (Mon-Sun).
3.  **File Modification Logic:**
    *   On "Drop":
        1.  Read the `Meal Planning.md` file.
        2.  Locate the correct Day header.
        3.  Insert `- [ ] [[Recipe Name]]` at the end of that day's list.
        4.  Write the file back to the vault.
4.  **Optimistic UI:**
    *   Update the UI state immediately while the file write is happening in the background to ensure snappy responsiveness.

**Testing Procedures:**
1.  **Drag Test:** Drag "Steak" onto "Friday". Verify the card "snaps" or indicates acceptance.
2.  **File Verification:** Open `Meal Planning.md`. Verify that `[[Steak]]` was appended correctly under the "Friday" header.
3.  **Idempotency:** Drag the same recipe to the same day twice. Decide behavior (allow duplicate vs. ignore).

### Phase 9: The Ingredient Aggregator
**Purpose:**
To automate the creation of a master ingredient list from the planned meals. This phase handles the logic of collecting all ingredients from the scheduled recipes, a necessary precursor to generating a shopping list.

**Implementation Steps:**
1.  **Collection Logic:**
    *   Input: A list of recipe paths (from the Meal Plan state).
    *   Process: Iterate through each recipe in the `RecipeIndex` and retrieve its `ingredients` array.
2.  **Normalization (Basic):**
    *   Lowercase all strings.
    *   Simple deductive logic: If multiple recipes call for "Onion", group them. (Note: Full NLP quantity addition like "1 cup + 2 tbsp" is out of scope for V1; just listing them side-by-side "Onion, Onion" is sufficient for the MVP).
3.  **Categorization:**
    *   Map ingredients to Aisles (Produce, Dairy, Meat) using a simple dictionary lookup or keyword matching (e.g., "milk" -> Dairy, "chicken" -> Meat).
    *   Fallback: "Pantry/Other" for unrecognized items.
4.  **Output Structure:**
    *   Create an internal object: `ShoppingList = { "Produce": ["Onion", "Garlic"], "Meat": ["Chicken Breast"] }`.

**Testing Procedures:**
1.  **Aggregation Test:** Plan "Chicken Parm" (Chicken, Cheese) and "Tacos" (Beef, Cheese). Verify the output list contains "Cheese" twice (or grouped).
2.  **Categorization Test:** Verify that "Apple" goes to Produce and "Steak" goes to Meat.
3.  **Empty Plan Test:** Verify that an empty meal plan produces an empty shopping list object without errors.

### Phase 10: Shopping List Writer
**Purpose:**
To complete the automation loop by writing the aggregated ingredients into the user's actual grocery list file. This replaces the manual copy-pasting process, ensuring the shopping list is always accurate to the meal plan.

**Implementation Steps:**
1.  **File Access:**
    *   Locate `groceryListNote` (from Settings).
2.  **Content Formatting:**
    *   Convert the `ShoppingList` object into Markdown checkboxes.
    *   Use Headers for categories:
        ```markdown
        ## Produce
        - [ ] Onion
        - [ ] Garlic
        ```
3.  **Write Strategy (Append vs. Replace):**
    *   *Safety:* Do not overwrite the whole file (user might have "Paper Towels" added manually).
    *   *Strategy:* Look for a specific section (e.g., `## From Mise`) or appended to the bottom.
    *   *Refined Strategy:* Read existing file, identify existing items, merge new items (avoiding duplicates if possible), and write back.
4.  **Trigger:**
    *   Add a "Generate Shopping List" button to the UI header.

**Testing Procedures:**
1.  **Generation Test:** Click the button. Open `00-Grocery.md`. Verify the ingredients are there.
2.  **Preservation Test:** Manually add "Toilet Paper" to the grocery list. Click "Generate" again. Verify "Toilet Paper" was NOT deleted.
3.  **Formatting Test:** Open the file in Obsidian Preview. Verify it renders as a clean, clickable checklist.

### Phase 11: Web Importer
**Purpose:**
To lower the friction of adding new recipes to the vault. This phase implements a scraper that can take a URL from a recipe website and automatically generate a correctly formatted Markdown recipe file in the user's vault.

**Implementation Steps:**
1.  **Input UI:**
    *   Create a Modal (Obsidian `Modal` class) with a single text input for a URL.
2.  **Scraping Engine:**
    *   Use a library like `recipe-data-extractor` or a custom fetch + `ld+json` parser.
    *   Extract: Title, Image URL, Prep Time, Cook Time, Ingredients (Array), and Instructions (String).
3.  **File Generation:**
    *   Map the scraped data to the vault's recipe template.
    *   Download the image to the `Resources/Assets/` folder.
    *   Create the new `.md` file in the `Recipes/` folder.
4.  **Immediate Feedback:**
    *   Upon success, automatically open the newly created recipe file.

**Testing Procedures:**
1.  **Scrape Test:** Paste a URL from a supported site (e.g., AllRecipes). Verify the resulting markdown file has correct frontmatter and an ingredient list.
2.  **Image Test:** Verify the image was downloaded and the link in the markdown file works.
3.  **Error Test:** Paste a non-recipe URL (e.g., Google Search). Verify the plugin shows a "Recipe not found" error message.

### Phase 12: Polish & Error Handling
**Purpose:**
To move the plugin from "working prototype" to "stable tool." This phase focuses on the edge cases and UI refinements that prevent crashes and ensure a smooth experience for the user.

**Implementation Steps:**
1.  **Error Boundaries:**
    *   Wrap React components in Error Boundaries to prevent a single broken card from crashing the whole view.
2.  **Edge Case Handling:**
    *   Handle "Missing Folder" errors (if the user deletes their Recipes folder).
    *   Handle "Empty File" or "Invalid YAML" errors in recipes.
3.  **UI/UX Refinement:**
    *   Add loading spinners for the initial scan.
    *   Implement "Quick Look" (opening the recipe file in a hover editor).
    *   Accessibility check: Ensure all buttons have labels for screen readers.
4.  **Theme Compatibility:**
    *   Finalize CSS using only Obsidian variables to ensure it looks good in 3rd party themes (e.g., Minimal, AnuPpuccin).

**Testing Procedures:**
1.  **Corruption Test:** Manually mess up the YAML in one recipe. Verify the other 149 recipes still load and the UI shows a "Broken Metadata" icon for that one card.
2.  **Theme Test:** Switch between Light and Dark modes. Verify contrast and readability.
3.  **UX Test:** Perform a "Full Loop" (Import -> Find -> Plan -> List). Count the clicks and look for friction points.

### Phase 13: Final Testing & V1.0 Release
**Purpose:**
The final validation of the "strangler fig" migration. This ensures that the plugin is completely stable, performance-optimized, and ready to replace the old Python/Dataview system entirely.

**Implementation Steps:**
1.  **Performance Profiling:**
    *   Measure the time it takes to scan 200+ recipes. Ensure it stays under 500ms.
2.  **End-to-End Dry Run:**
    *   A full week of actual usage: planning real meals and generating real grocery lists.
3.  **Documentation:**
    *   Write a `README.md` for the plugin explaining features and settings.
4.  **Cleanup:**
    *   Remove debug `console.log` statements.
    *   Final code review for security and efficiency.

**Testing Procedures:**
1.  **Final Verification:** Verify that the original `Cookbook.md` (Dataview) and `index_recipes.py` are no longer needed for any daily task.
2.  **Stability Test:** Leave Obsidian open for 24 hours. Verify no memory leaks or background process hangs.
3.  **Production Build:** Perform the final `npm run build` and verify the `main.js` works in a clean test vault.
