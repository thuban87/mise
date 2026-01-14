---
tags:
  - projects
  - active
  - mise
---
# CLAUDE.md - Mise

**Purpose:** Instructions for AI assistants working on the **Mise** (Obsidian Plugin) project.
**Last Updated:** January 13, 2026

---

## ⚠️ CRITICAL: Read This First

### Git Protocol
**DO NOT perform git commands.**
- The user will handle all git operations.
- **Your Job:** Suggest commit messages/descriptions when a task is done.
- **Reminder:** When starting a new session, ask the user to confirm the current branch.

### No MVP Pressure
**DO NOT use MVP/launch-driven language.**
- ❌ "We should defer this until after MVP"
- ❌ "That can wait until post-launch"
- ❌ "Let's ship the minimum first"
- ✅ "This is a Phase 15 feature—want to add it now or later?"
- ✅ "We can build this anytime. What's your priority?"

This is a personal utility project with **infinite runway**. Features get built when they get built.

---

## 📋 Project Overview

**Mise** (from *Mise en place*) is a culinary operating system for Obsidian.

**Goal:** Transform a folder of Markdown recipes into an integrated tool for:
- 📚 **Discovery** — Visual cookbook with search and filters
- 📅 **Planning** — Drag-and-drop meal calendar
- 🛒 **Shopping** — Automated grocery list generation

### Core Metaphors
| Name | Component | What It Does |
|------|-----------|--------------|
| The Brain | RecipeIndexer | Real-time background indexing |
| The Gallery | CookbookView | Visual grid of recipe cards |
| The Station | MealCalendar | Drag-and-drop meal planning |
| The Prep | ShoppingListService | Ingredient aggregation |
| The Import | ImporterService | Web recipe scraping |

---

## 🔁 Phase Completion Protocol (MANDATORY)

**Every phase must follow this exact workflow. NO EXCEPTIONS.**

```
┌─────────────────────────────────────────────────────────────┐
│  1. CHECK-IN                                                │
│     • Confirm which phase we're starting                    │
│     • Review Feature Roadmap for that phase's scope         │
│     • Ask clarifying questions BEFORE writing code          │
│     • Remind user to verify git branch                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. DO THE WORK                                             │
│     • Implement according to the roadmap                    │
│     • Follow the modular architecture                       │
│     • Commit logical chunks (user handles git)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. TEST THE WORK  ⚠️ CRITICAL ⚠️                           │
│     • Build the plugin: npm run build                       │
│     • Load it in Obsidian (dev vault)                       │
│     • Verify EACH acceptance criterion from roadmap         │
│     • Document any bugs or edge cases discovered            │
│     • DO NOT PROCEED until tests pass                       │
│                                                             │
│     ┌─────────────────────────────────────────────────┐     │
│     │ ❌ NEVER skip testing to "update docs first"   │     │
│     │ ❌ NEVER mark phase complete without testing   │     │
│     │ ❌ NEVER assume it works without verification  │     │
│     └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UPDATE DOCUMENTATION                                    │
│     • Append session details to Handoff Log.md              │
│     • Mark phase complete in Feature Roadmap.md             │
│     • Suggest commit message                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. MOVE TO NEXT PHASE                                      │
│     • Only after steps 1-4 are complete                     │
│     • Confirm with user before starting new phase           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture (Quick Reference)

**Philosophy:** Modular from day one. Never let `main.ts` become a monolith.

```
mise/src/
├── main.ts                    # Thin orchestrator only
├── types/
│   └── index.ts               # All interfaces
├── services/
│   ├── RecipeIndexer.ts       # File watching, parsing, caching
│   ├── MealPlanService.ts     # Read/write meal plan files
│   ├── ShoppingListService.ts # Aggregation + file generation
│   └── ImporterService.ts     # Web scraping + file creation
├── parsers/
│   ├── IngredientParser.ts    # Extract ingredients from body
│   ├── FrontmatterParser.ts   # Normalize time, ratings, etc.
│   └── MealPlanParser.ts      # Parse meal plan structure
├── ui/
│   ├── views/
│   │   ├── CookbookView.tsx   # Full-tab cookbook
│   │   └── CookbookSidebar.tsx
│   ├── components/
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeGrid.tsx
│   │   ├── RecipeModal.tsx
│   │   ├── FilterBar.tsx
│   │   └── MealCalendar.tsx
│   └── settings/
│       └── MiseSettingsTab.ts
└── utils/
    ├── constants.ts
    └── helpers.ts
```

See `ADR-001-Architecture.md` for full technical specification.

### Key Interfaces
```typescript
interface Recipe {
  path: string;
  title: string;
  folder: string;
  category: RecipeCategory;
  tags: string[];
  rating: number | null;        // null = "Unrated"
  servings: string;
  prepTime: number | null;      // Minutes (integer)
  cookTime: number | null;      // Minutes (integer)
  source: string | null;
  image: string | null;
  dietaryFlags: DietaryFlag[];
  ingredients: string[];
  lastModified: number;
}

type RecipeCategory = 'Main' | 'Breakfast' | 'Appetizer' | 'Side' | 'Dessert' | 'Beverage' | 'Snack' | 'Uncategorized';

type DietaryFlag = 'crohns-safe' | 'low-fiber' | 'high-fiber' | 'high-protein' | 'high-carb' | 'low-carb' | 'dairy-free' | 'gluten-free' | 'vegetarian' | 'vegan' | 'keto' | 'paleo';
```

---

## 📁 Development Environment

| Purpose | Path |
|---------|------|
| Source Code | `C:\Users\bwales\projects\obsidian-plugins\mise` |
| Deploy Target | `G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\mise` |
| Recipe Files | `Life/Household/Kitchen/Recipes/` |
| Meal Plans | `Life/Household/Kitchen/Meal Plans/` |
| Shopping Lists | `Life/Household/Shopping Lists/` |

### Development Commands

```bash
# From the project root: C:\Users\bwales\projects\obsidian-plugins\mise

npm install      # Install dependencies (first time only)
npm run dev      # Watch mode (continuous build to /dist)
npm run build    # Production build
```

### Deployment Workflow

After building, you must copy the artifacts to the Obsidian plugins directory:

```powershell
# PowerShell deployment commands (run from project root)
$src = "C:\Users\bwales\projects\obsidian-plugins\mise"
$dest = "G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\mise"

# Create plugin directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $dest

# Copy required files
Copy-Item "$src\main.js" "$dest\main.js" -Force
Copy-Item "$src\styles.css" "$dest\styles.css" -Force
Copy-Item "$src\manifest.json" "$dest\manifest.json" -Force
```

**Or as a one-liner:**
```powershell
$d="G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\mise"; New-Item -ItemType Directory -Force -Path $d; Copy-Item main.js,styles.css,manifest.json $d -Force
```

### Quick Reference: Dev Cycle

| Step | Command/Action |
|------|----------------|
| 1. Build | `npm run build` |
| 2. Deploy | Run PowerShell copy commands above |
| 3. Reload | In Obsidian: Ctrl+P → "Reload app without saving" |
| 4. Verify | Check Developer Console for "Mise loaded" |

> [!TIP]
> Consider adding a `deploy` npm script in `package.json` to automate step 2:
> ```json
> "scripts": {
>   "deploy": "npm run build && powershell -Command \"Copy-Item main.js,styles.css,manifest.json 'G:\\My Drive\\IT\\Obsidian Vault\\My Notebooks\\.obsidian\\plugins\\mise' -Force\""
> }
> ```

---

## ✅ Workflow Guidelines

### The "Brad Protocol"
1. **Micro-Steps:** Break tasks into zero-willpower atomic actions
2. **Strangler Fig:** New features coexist with old system until proven
3. **Explain Why:** Justify technical choices briefly (e.g., "Using `metadataCache` for performance")

### Session Handoff Protocol
At the end of each session:

1. **Update `Handoff Log.md`** with:
   - Session date and summary
   - What was accomplished (with file references)
   - What was tested and results
   - Any bugs or issues discovered
   - Next session's starting point

2. **Update `Feature Roadmap.md`**:
   - Mark completed tasks with `[x]`
   - Update phase status

3. **Suggest commit message** (user will do the actual commit)

4. **Confirm plugin builds** and loads correctly

---

## 🧪 Technical Patterns

### Ingredient Parsing
```typescript
// Match any Ingredients header (with or without emoji)
const INGREDIENTS_HEADER = /##\s+(?:🥘\s*)?Ingredients/i;

// Extract section content until next header
const SECTION_CONTENT = /##\s+(?:🥘\s*)?Ingredients\s*\n([\s\S]*?)(?=\n##|\Z)/i;
```

### Time Normalization
```typescript
// Input: "5 mins", "1 hour 30 minutes", "90", "1h 30m"
// Output: number (minutes)
function parseTime(timeStr: string): number | null {
  // Implementation in FrontmatterParser.ts
}

// Input: 90
// Output: "1 hour 30 minutes"
function formatTime(minutes: number): string {
  // Implementation in helpers.ts
}
```

### Image Resolution
```typescript
// Resolve vault paths to displayable URLs
const imageUrl = app.vault.adapter.getResourcePath(imagePath);
```

---

## 📚 Documentation Index

| Document | Purpose | When to Update |
|----------|---------|----------------|
| `Project Summary.md` | High-level vision and overview | Major scope changes only |
| `Feature Roadmap.md` | Detailed phase/task breakdown | Every phase completion |
| `Handoff Log.md` | Session-by-session notes | Every session |
| `CLAUDE.md` | This file—AI instructions | Architecture/workflow changes |
| `ADR-001-Architecture.md` | Technical decisions | When architecture evolves |

---

## ✔️ Pre-Coding Checklist

Before writing any code, confirm:

- [ ] Which **Phase** are we in? (Check `Feature Roadmap.md`)
- [ ] Is the user on the correct **git branch**?
- [ ] Have we reviewed the **Handoff Log** for context from last session?
- [ ] Do we have a plan for a **testable micro-step win**?
- [ ] Are we following the **modular architecture**? (No dumping code in main.ts)

---

## 🚫 Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|-----------|
| Put logic in `main.ts` | Create/use a service class |
| Skip testing to update docs | TEST FIRST, then docs |
| Use MVP/launch pressure language | Reference phases instead |
| Make assumptions about scope | Ask clarifying questions |
| Perform git commands | Suggest commits, let user do git |

---

*This document governs AI assistant behavior on this project. Follow it precisely.*
