---
tags:
  - projects
  - active
  - mise
  - docs
---
# Mise: Feature Roadmap

> [!IMPORTANT]
> **No MVP. No Launch Date. No Rush.**
> This is a personal utility project with infinite runway. Features get done when they get done. Do not pressure the user with "we should do this after MVP" language.

**Last Updated:** January 13, 2026
**Current Phase:** Phase 9 - Favorites & Recently Viewed

---

## 📋 How to Use This Document

This roadmap is the **through-line** for the entire project. It defines what gets built and in what order. 

- **Phase Status Key:**
  - `[ ]` Not Started
  - `[/]` In Progress
  - `[x]` Completed
  - `[~]` Changed/Descoped

- **Updates to this document** should be limited to:
  - Marking phases complete
  - Noting scope changes with `[~]` and a brief explanation
  - Adding new phases at the end

- **Detailed implementation notes** belong in the `Handoff Log.md`, not here.

---

## 🏗️ Architecture Overview

Mise uses a **modular, service-oriented architecture** to avoid the "monolithic main.ts" problem. All business logic lives in dedicated service classes.

```
mise/src/
├── main.ts                    # Thin orchestrator only
├── types/                     # All interfaces
├── services/                  # Business logic (RecipeIndexer, MealPlanService, etc.)
├── parsers/                   # Pure parsing functions
├── ui/                        # React components + Obsidian views
└── utils/                     # Constants and helpers
```

See `ADR-001-Architecture.md` for the full technical specification.

---

## 🍽️ Core Data Structures

### Recipe Interface
```typescript
interface Recipe {
  path: string;              // Vault-relative path
  title: string;             // Display name
  folder: string;            // Parent folder (for category inference)
  
  // Frontmatter fields
  category: RecipeCategory;  // 'Main' | 'Breakfast' | 'Appetizer' | 'Side' | 'Dessert' | 'Beverage' | 'Snack' | 'Uncategorized'
  tags: string[];
  rating: number | null;     // 1-5, null = "Unrated"
  servings: string;          // "4" or "8 pancakes"
  prepTime: number | null;   // Stored as minutes
  cookTime: number | null;   // Stored as minutes
  source: string | null;     // URL
  image: string | null;      // URL or vault path
  
  // Dietary flags
  dietaryFlags: DietaryFlag[];
  
  // Nutritional info (optional, for future API integration)
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  
  // Parsed from body
  ingredients: string[];
  
  // Metadata
  lastModified: number;      // Timestamp
}

type RecipeCategory = 
  | 'Main' 
  | 'Breakfast' 
  | 'Appetizer' 
  | 'Side' 
  | 'Dessert' 
  | 'Beverage' 
  | 'Snack' 
  | 'Uncategorized';

type DietaryFlag =
  | 'crohns-safe'
  | 'low-fiber'
  | 'high-fiber'
  | 'high-protein'
  | 'high-carb'
  | 'low-carb'
  | 'dairy-free'
  | 'gluten-free'
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'paleo';
```

### MealPlan Interface
```typescript
interface MealPlan {
  month: string;             // "January 2026"
  days: MealDay[];
}

interface MealDay {
  date: string;              // "2026-01-15"
  dayName: string;           // "Wednesday"
  breakfast: PlannedMeal[];
  lunch: PlannedMeal[];
  dinner: PlannedMeal[];
}

interface PlannedMeal {
  recipePath: string;        // Link to recipe
  recipeTitle: string;       // Cached for display
  scaledServings?: number;   // If user scaled the recipe
}
```

### ShoppingList Interface
```typescript
interface ShoppingList {
  generatedAt: string;       // ISO timestamp
  dateRange: {
    start: string;
    end: string;
  };
  mode: ShoppingMode;
  aisles: Aisle[];
}

type ShoppingMode = 'normal' | 'bulk-buy' | 'pantry' | 'quick-trip';

interface Aisle {
  name: string;              // "Produce", "Dairy", "Meat", etc.
  items: ShoppingItem[];
}

interface ShoppingItem {
  ingredient: string;        // Raw ingredient string
  quantity?: string;         // Parsed quantity if available
  fromRecipes: string[];     // Which recipes need this
  checked: boolean;
}
```

---

## 🚀 Phase Breakdown

### Phase 0: Documentation & Planning
- **Goal:** Establish project foundation and comprehensive documentation.
- **Status:** `[x]` Completed

| Task | Status |
|------|--------|
| Discovery session with PM | `[x]` |
| Create Feature Roadmap (this document) | `[x]` |
| Update Project Summary | `[x]` |
| Update CLAUDE.md with dev workflow | `[x]` |
| Update Handoff Log structure | `[x]` |
| Create ADR-001-Architecture | `[x]` |

---

### Phase 1: Foundation & Configuration
- **Goal:** Establish a compiling plugin skeleton with settings.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Initialize npm project | `[x]` | TypeScript + esbuild |
| Create `manifest.json` | `[x]` | Plugin metadata |
| Create modular folder structure | `[x]` | services/, parsers/, ui/, utils/, types/ |
| Implement `MisePlugin` class (thin) | `[x]` | Wires up services only |
| Implement `MiseSettingsTab` | `[x]` | Settings UI with folder autocomplete |
| Setting: Recipe Folder Path | `[x]` | Default: `Life/Household/Kitchen/Recipes` |
| Setting: Meal Plan Folder Path | `[x]` | Default: `Life/Household/Kitchen/Meal Plans` |
| Setting: Shopping List Folder Path | `[x]` | Default: `Life/Household/Shopping Lists` |
| Setting: Auto-archive shopping lists | `[x]` | Dropdown: on/off/ask |
| Setting: Aisle configuration | `[x]` | Default aisle keywords defined |

**Acceptance Criteria:**
- [x] Plugin loads in Obsidian without errors
- [x] Settings persist across restarts
- [x] Console shows "Mise loaded" message

---

### Phase 2: The Silent Indexer
- **Goal:** Real-time background indexing to replace Python script.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `RecipeIndexer` service | `[x]` | Uses Obsidian Events class |
| Implement `scanVault()` | `[x]` | Recursive folder scan |
| Hook `vault.on('create')` | `[x]` | Add new recipes |
| Hook `vault.on('modify')` | `[x]` | Debounced (300ms) |
| Hook `vault.on('delete')` | `[x]` | Remove deleted recipes |
| Hook `vault.on('rename')` | `[x]` | Handle file moves/renames |
| Extract frontmatter via `metadataCache` | `[x]` | Fast, no re-parsing |
| In-memory recipe store | `[x]` | Map<path, Recipe> |
| Emit events on index changes | `[x]` | recipe-added, recipe-updated, recipe-deleted, index-ready |

**Acceptance Criteria:**
- [x] Initial scan completes in <500ms for 150+ recipes
- [x] Creating a new recipe file triggers index update
- [x] Modifying frontmatter triggers index update
- [x] Deleting a recipe removes it from index
- [x] Console logs confirm operations (DEBUG mode available)

---

### Phase 3: The Ingredient Parser
- **Goal:** Extract and normalize ingredients from recipe bodies.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `IngredientParser` module | `[x]` | Pure functions |
| Detect `## 🥘 Ingredients` header | `[x]` | Multiple patterns, case-insensitive |
| Extract lines until next header | `[x]` | Handles ## or HR |
| Strip Markdown syntax | `[x]` | Bullets, checkboxes, numbers |
| Store clean ingredient array | `[x]` | In Recipe object |
| Handle missing header gracefully | `[x]` | Returns empty array |

**Bonus implemented:**
- `parseIngredientQuantity()` - Extracts quantity, unit, ingredient
- `normalizeIngredient()` - For future deduplication

**Acceptance Criteria:**
- [x] Standard ingredient lists parse correctly
- [x] Task-list format (`- [ ]`) parses correctly
- [x] Missing header doesn't crash indexer
- [x] Ingredients accessible in Recipe object

---

### Phase 4: Time Format Migration
- **Goal:** Normalize all time fields to integer minutes.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `FrontmatterParser` module | `[x]` | Already existed from Phase 1 |
| Parse time strings to minutes | `[x]` | Handles "5 mins", "1h 30m", etc. |
| Create migration script | `[x]` | `TimeMigrationService` |
| Update all recipe files | `[x]` | Via "Migrate Recipe Time Formats" command |
| Display formatter | `[x]` | `formatTime()` → "1 hour 30 minutes" |

**Acceptance Criteria:**
- [x] All existing recipes converted to integer format
- [x] Parser handles edge cases (empty, malformed)
- [x] Display shows human-readable times

---

### Phase 5: The Cookbook View (UI Skeleton)
- **Goal:** Create the visual container for recipe browsing.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `CookbookView` (ItemView) | `[x]` | Full-tab view with React |
| Create `CookbookSidebar` (View) | `[x]` | Right sidebar, compact mode |
| Register view types | `[x]` | MISE_COOKBOOK_VIEW_TYPE, MISE_SIDEBAR_VIEW_TYPE |
| Add ribbon icon (book-open) | `[x]` | Opens full view |
| Add command: "Open Cookbook" | `[x]` | Opens full view |
| Add command: "Open Cookbook Sidebar" | `[x]` | Opens sidebar |
| Mount React root | `[x]` | React 18 with new JSX transform |
| Pass RecipeIndexer data to React | `[x]` | Via RecipeContext |
| Basic list render proof-of-concept | `[x]` | Titles, categories, ratings |

**Acceptance Criteria:**
- [x] Ribbon icon opens full cookbook view
- [x] Command opens sidebar view
- [x] View survives Obsidian restart
- [x] Recipe titles display from index

---

### Phase 6: The Recipe Card
- **Goal:** Beautiful, informative recipe cards.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `RecipeCard` component | `[x]` | Full card with image, badges, pills |
| Hero image display | `[x]` | From frontmatter `image` field |
| Fallback placeholder image | `[x]` | Gradient + category emoji |
| Title display | `[x]` | Clamped to 2 lines |
| Rating as stars | `[x]` | ★★★★☆ overlay on image |
| Time badges | `[x]` | Combined prep+cook time |
| Category badge | `[x]` | Colored accent badge |
| Servings badge | `[x]` | With emoji |
| Dietary flag pills | `[x]` | Uppercase, max 3 shown |
| Hover effect | `[x]` | Lift + shadow + image zoom |
| Click opens recipe file | `[x]` | Via context |
| `RecipeCardMini` for sidebar | `[x]` | Thumbnail, title, rating, time |

**CSS Requirements:**
- [x] Grid layout container (`RecipeGrid`)
- [x] Responsive columns (auto-fill minmax)
- [x] Light/Dark mode compatibility
- [x] Mobile-friendly responsive breakpoints

**Acceptance Criteria:**
- [x] Cards render with all metadata
- [x] Images load from URLs and local paths
- [x] Responsive grid adapts to window size
- [x] Looks good in light and dark themes

---

### Phase 7: Recipe Quick Look Modal
- **Goal:** Preview recipes without leaving the cookbook.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `RecipeModal` component | `[x]` | React modal with glassmorphism |
| Hero image (large) | `[x]` | Full-width, emoji fallback |
| All metadata badges | `[x]` | Rating, time, servings, category |
| Interactive ingredient checkboxes | `[x]` | **CRITICAL**: Session-only state |
| Collapsible ingredients list | `[-]` | Skipped - always visible works well |
| "Open Recipe" button | `[x]` | Opens .md file |
| "Add to Meal Plan" button | `[x]` | Placeholder (Phase 11) |
| Backdrop blur effect | `[x]` | Glassmorphism |
| Click-outside to close | `[x]` | Works |
| Swipe-to-dismiss (mobile) | `[-]` | Deferred - optional |
| Keyboard: Escape to close | `[x]` | Accessibility |

**User Workflow Note:** User checks off ingredients while cooking. Must work without entering source mode.

**Acceptance Criteria:**
- [x] Modal opens on card click
- [x] All recipe info visible
- [x] Ingredient checkboxes work (session state, not persisted to file)
- [x] Works well on mobile (touch-friendly, scrollable)
- [x] Escape and click-outside close modal

---

### Phase 8: Search & Filter Logic
- **Goal:** Fast, intuitive recipe discovery.
- **Status:** `[x]` Completed

| Task | Status | Notes |
|------|--------|-------|
| Create `FilterBar` component | `[x]` | Full view with all filters |
| Create `FilterBarCompact` component | `[x]` | Sidebar with search/category/time |
| Search input (title + ingredients) | `[x]` | Instant filtering |
| Category dropdown/filter | `[x]` | Single-select |
| Rating filter | `[x]` | 5★, 4★+, 3★+, Unrated |
| Max cook time filter | `[x]` | ≤15m, ≤30m, ≤1h, ≤2h |
| Dietary flags filter | `[x]` | Multi-select chips |
| Missing image filter | `[x]` | Maintenance helper |
| Source filter | `[-]` | Deferred |
| Sort dropdown | `[x]` | Rating, Time, A-Z, Recent |
| "Unrated only" toggle | `[x]` | Combined with rating filter |
| Clear filters button | `[x]` | Reset all |
| Result count display | `[x]` | "Showing X of Y" |
| Empty state message | `[x]` | Friendly message |

**Performance:**
- [x] Filters feel instant (useMemo)

**Acceptance Criteria:**
- [x] Typing in search shows matching recipes instantly
- [x] Multiple filters combine correctly (AND logic)
- [x] Sorting works correctly
- [x] Empty state is friendly, not an error

---

### Phase 9: Meal Plan Reader
- **Goal:** Parse existing meal plan files.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Create `MealPlanService` | `[ ]` | Service class |
| Create `MealPlanParser` | `[ ]` | Pure functions |
| Locate meal plan files | `[ ]` | From settings path |
| Parse month header structure | `[ ]` | `# January 2026` |
| Parse day headers | `[ ]` | `## Monday, Jan 15` |
| Parse meal sections | `[ ]` | Breakfast, Lunch, Dinner tables |
| Extract recipe wikilinks | `[ ]` | `[[Recipe Name]]` |
| Build MealPlan state object | `[ ]` | In-memory representation |
| Watch for meal plan changes | `[ ]` | `vault.on('modify')` |
| "Planned" indicator on cards | `[ ]` | Badge showing which days |

**Meal Plan Markdown Format:**
```markdown
# Meal Plan - January 2026

## Week 1

### 🍳 Breakfast
| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-----|-----|-----|-----|-----|-----|-----|
| [[Pancakes]] | - | [[Eggs]] | - | - | [[Waffles]] | - |

### 🥗 Lunch
| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-----|-----|-----|-----|-----|-----|-----|
| Leftovers | [[Salad]] | - | - | - | - | - |

### 🍽️ Dinner
| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-----|-----|-----|-----|-----|-----|-----|
| [[Pepper Steak]] | [[Tacos]] | [[Pasta]] | - | - | - | - |
```

**Acceptance Criteria:**
- [ ] Parser correctly extracts all planned meals
- [ ] Recipe cards show "Planned: Mon, Wed" badges
- [ ] Changes to meal plan file update UI

---

### Phase 10: Meal Plan Calendar UI
- **Goal:** Visual calendar for viewing/editing meal plans.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Create `MealCalendar` component | `[ ]` | React component |
| Month view layout | `[ ]` | 7x4/5 grid |
| Day cells with meal slots | `[ ]` | 3 rows per day |
| Display planned recipes | `[ ]` | Compact card or pill |
| Navigate months | `[ ]` | Previous/Next arrows |
| Generate weekly view on command | `[ ]` | Extracts current week |
| Mobile-friendly layout | `[ ]` | Stack or scroll |

**Acceptance Criteria:**
- [ ] Month calendar displays correctly
- [ ] Planned meals show in correct slots
- [ ] Can navigate between months
- [ ] Weekly view generation works

---

### Phase 11: Drag-and-Drop Assignment
- **Goal:** Assign recipes to days by dragging.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Make `RecipeCard` draggable | `[ ]` | HTML5 DnD API |
| Day cells as drop targets | `[ ]` | Accept recipe drops |
| Meal slot targeting | `[ ]` | Breakfast, Lunch, or Dinner |
| Visual feedback on drag | `[ ]` | Highlight valid targets |
| Drop handler | `[ ]` | Add to MealPlan state |
| Write changes to file | `[ ]` | Update markdown |
| Configurable insert content | `[ ]` | Settings: what gets inserted |

**Insert Content Options (Settings):**
| Option | Default |
|--------|---------|
| Recipe wikilink | ✅ ON |
| Servings | ❌ OFF |
| Prep + Cook Time | ❌ OFF |
| Ingredients (inline) | ❌ OFF |
| Ingredients (callout) | ❌ OFF |
| Source link | ❌ OFF |

**Acceptance Criteria:**
- [ ] Drag recipe card onto day cell
- [ ] Correct meal slot is targeted
- [ ] Meal plan file is updated correctly
- [ ] UI updates immediately (optimistic)
- [ ] Insert content matches settings

---

### Phase 12: Ingredient Aggregator
- **Goal:** Combine ingredients from planned meals.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Create `ShoppingListService` | `[ ]` | Service class |
| Collect recipes from date range | `[ ]` | Week or custom |
| Extract all ingredients | `[ ]` | From Recipe objects |
| Group by aisle | `[ ]` | Inferred or configured |
| Deduplicate items | `[ ]` | Basic string matching |
| Track which recipes need each item | `[ ]` | For reference |

**Aisle Inference Rules:**
| Keywords | Aisle |
|----------|-------|
| milk, cheese, butter, cream, yogurt | Dairy |
| chicken, beef, pork, steak, ground | Meat |
| lettuce, tomato, onion, garlic, pepper, apple, lemon | Produce |
| bread, buns, tortillas | Bakery |
| pasta, rice, flour, sugar, oil, vinegar, sauce | Pantry |
| (default) | Other |

**Acceptance Criteria:**
- [ ] All planned recipes' ingredients collected
- [ ] Items grouped by aisle
- [ ] Duplicate items grouped together
- [ ] Recipe source tracked per item

---

### Phase 13: Shopping List Writer
- **Goal:** Generate formatted shopping list files.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Generate markdown file | `[ ]` | `Grocery List - January Week 2.md` |
| Header with date range | `[ ]` | For reference |
| Aisle sections with headers | `[ ]` | `## 🥬 Produce` |
| Checkbox items | `[ ]` | `- [ ] Onion (from: Fajitas, Stew)` |
| List mode support | `[ ]` | Normal, Bulk Buy, Pantry, Quick Trip |
| Auto-archive setting | `[ ]` | Move old lists to Archive/ |
| "Generate Shopping List" command | `[ ]` | With date range picker |
| "Generate Shopping List" button in UI | `[ ]` | Quick access |

**Shopping List Modes:**
| Mode | Behavior |
|------|----------|
| Normal | Group by aisle |
| Bulk Buy | Group by protein type (Beef, Chicken, Pork, etc.) |
| Pantry | Only show pantry/shelf-stable items |
| Quick Trip | Only show perishables |

**Acceptance Criteria:**
- [ ] Shopping list file created with correct format
- [ ] All modes produce correctly grouped lists
- [ ] Old lists archived (if setting enabled)
- [ ] List is usable on mobile Obsidian

---

### Phase 14: Web Importer
- **Goal:** Import recipes from URLs.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Create `ImporterService` | `[ ]` | Service class |
| Create import modal | `[ ]` | URL input |
| Fetch and parse URL | `[ ]` | Recipe JSON-LD or scraping |
| Extract: title, image, times, ingredients, instructions | `[ ]` | Standard fields |
| Extract: nutrition (if available) | `[ ]` | For future use |
| Category selection in modal | `[ ]` | User picks on import |
| Generate markdown file | `[ ]` | Using recipe template |
| Download image locally (optional) | `[ ]` | Setting |
| Open new file after import | `[ ]` | For review |
| Bulk import mode | `[ ]` | Multiple URLs, goes to inbox |

**Acceptance Criteria:**
- [ ] Single URL import works
- [ ] Recipe file has correct frontmatter
- [ ] Image linked or downloaded
- [ ] User can choose category
- [ ] Bulk import creates files in inbox folder

---

### Phase 15: Recipe Scaling
- **Goal:** Scale recipes up or down.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| Parse ingredient quantities | `[ ]` | "2 cups", "1/2 tbsp" |
| Create `QuantityParser` module | `[ ]` | Pure functions |
| Scale calculation | `[ ]` | Multiply by factor |
| Scaling UI in modal | `[ ]` | "Scale to X servings" |
| Display scaled ingredients | `[ ]` | Non-destructive preview |
| "Copy scaled recipe" action | `[ ]` | For one-off scaling |

**Acceptance Criteria:**
- [ ] Common quantity formats parse correctly
- [ ] Scaling math is accurate
- [ ] UI shows scaled quantities clearly
- [ ] Original recipe unchanged

---

### Phase 16: Polish & Error Handling
- **Goal:** Production-quality stability.
- **Status:** `[ ]` Not Started

| Task | Status | Notes |
|------|--------|-------|
| React Error Boundaries | `[ ]` | Catch component crashes |
| Handle missing recipe folder | `[ ]` | Friendly error message |
| Handle malformed frontmatter | `[ ]` | Skip file, log warning |
| Handle missing images | `[ ]` | Fallback placeholder |
| Loading spinners | `[ ]` | During initial scan |
| Theme compatibility | `[ ]` | Test with Minimal, AnuPpuccin |
| Mobile usability pass | `[ ]` | Touch targets, scrolling |
| Accessibility audit | `[ ]` | ARIA labels, keyboard nav |

**Acceptance Criteria:**
- [ ] Plugin handles edge cases gracefully
- [ ] No crashes on malformed data
- [ ] Looks good in popular themes
- [ ] Usable on mobile

---

### Phase 17: Nutritional Info (Future)
- **Goal:** Track and display nutritional data.
- **Status:** `[ ]` Not Started (Stretch Goal)

| Task | Status | Notes |
|------|--------|-------|
| Integrate nutrition API | `[ ]` | USDA or Nutritionix |
| Lookup by ingredient | `[ ]` | Parse and query |
| Store in Recipe frontmatter | `[ ]` | calories, protein, carbs, fat |
| Display in modal | `[ ]` | Nutrition facts card |
| Sum for meal plan day/week | `[ ]` | Aggregated view |

---

### Phase 18: Chronos Integration (Future)
- **Goal:** Sync meal plans with calendar.
- **Status:** `[ ]` Not Started (If Needed)

| Task | Status | Notes |
|------|--------|-------|
| Emit events on meal plan changes | `[ ]` | Chronos event system |
| Create calendar events for meals | `[ ]` | Optional setting |
| Grocery shopping reminders | `[ ]` | Day before meal plan starts |

---

## 📊 Priority Summary

Based on user feedback, the implementation priority is:

1. **Visual Cookbook Grid** (Phases 5-8)
2. **Automated Shopping List** (Phases 12-13)
3. **Drag-and-Drop Planning** (Phases 10-11)
4. **Real-Time Indexing** (Phases 2-3) — foundational, happens first
5. **Web Importer** (Phase 14)
6. **Recipe Scaling** (Phase 15)
7. **Nutritional Info** (Phase 17) — stretch goal

The indexer is foundational and must come first, even though the cookbook is the "most wanted" feature, because the cookbook depends on having indexed data to display.

---

## 🔮 Ideas Parking Lot

Features that came up but aren't scheduled yet:

- [ ] Custom template for meal plan insertion (advanced settings)
- [ ] Print-friendly recipe view
- [ ] Recipe export (to PDF or sharing)
- [ ] Grocery list export to Reminders/Todoist
- [ ] Voice input for grocery items (requires separate app)
- [ ] Calorie tracking dashboard
- [ ] Pantry inventory management
- [ ] "What can I make?" mode (based on available ingredients)
- [ ] Recipe collections/favorites list
- [ ] Cooking timers integration

---

*This document is the source of truth for what gets built. Update phase statuses as work progresses.*
