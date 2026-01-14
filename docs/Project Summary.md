---
tags:
  - projects
  - active
  - mise
  - docs
---
# Mise - Project Summary

> **Tagline:** Everything in its place.

**Mise** (from *Mise en place*—the culinary practice of preparing and organizing all ingredients before cooking) is a **culinary operating system for Obsidian**. It transforms a folder of Markdown recipe files into an integrated application for discovery, planning, and shopping.

---

## 🎯 Project Philosophy

> [!IMPORTANT]
> **No MVP. No Launch Date. No Rush.**
> 
> This is a personal utility project with infinite runway. Features get built when they get built, driven by real need rather than artificial deadlines. The goal is a tool that genuinely improves the cooking workflow, not a product to ship.

**Target User:** Brad (solo developer, Crohn's-conscious meal planner, bulk-buy strategist)
**Future Distribution:** BRAT → Obsidian Community Plugins (when ready, no pressure)

---

## 🚨 The Problem: The Tipping Point

The current recipe system has grown beyond manual management:

### 1. Index Friction
- **Now:** An external Python script (`index_recipes.py`) runs daily via Task Scheduler to generate a JSON index
- **Pain:** The index is often out of sync; adding a recipe requires waiting for the next scheduled run or manually triggering the script

### 2. Visual Stagnation
- **Now:** The "Cookbook" dashboard uses Dataview tables and embedded code blocks
- **Pain:** It's clunky, requires constant switching between views, and lacks the visual appeal of a modern cooking app

### 3. The Planning Gap
- **Now:** Meal planning is manual—typing recipe names into a Markdown table, looking up ingredients in separate files, copy-pasting into a grocery list
- **Pain:** High friction between "deciding what to cook" and "having a shopping list ready"

### 4. The Grandma Test
- **Now:** Using the current system requires understanding Dataview syntax, running Python scripts, and navigating complex file structures
- **Goal:** Build something intuitive enough that a non-technical user could browse recipes and plan meals

---

## ✨ The Solution: Mise

Mise automates the "prep work" of kitchen management, allowing you to focus on the cooking.

### Core Pillars

#### 🧠 The Brain (Silent Indexer)
**What it does:** A native background service replaces the Python script with real-time, event-driven indexing.

**The Experience:**
- The moment you save a recipe, it's indexed
- Ingredients are parsed and searchable immediately
- No terminal commands, no waiting, no manual sync

---

#### 📚 The Gallery (Visual Cookbook)
**What it does:** A dedicated, visual grid view for recipe discovery—like Paprika or Mealime, but inside Obsidian.

**The Experience:**
- **Visual Cards:** Large imagery, star ratings, cook times, dietary flags at a glance
- **Quick Look Modal:** Preview a recipe without leaving the cookbook (mobile-friendly)
- **Fuzzy Search:** Find recipes by ingredient, category, rating, cook time, or dietary needs
- **Dual View:** Open as a full tab or a sidebar panel

---

#### 📅 The Station (Meal Planner)
**What it does:** A drag-and-drop calendar interface for assigning recipes to meals.

**The Experience:**
- **Monthly View:** See breakfast, lunch, and dinner for the entire month
- **Drag-and-Drop:** Drag a recipe card onto Tuesday's dinner slot
- **Configurable Output:** Choose what gets inserted (just a link, or link + ingredients + time)
- **Weekly Generation:** Generate a printable weekly view on command

---

#### 🛒 The Prep (Shopping Aggregator)
**What it does:** Automatically generates a grocery list from planned meals.

**The Experience:**
- **One-Click Generation:** Select a date range, click "Generate Shopping List"
- **Smart Grouping:** Items grouped by aisle (configurable)
- **Multiple Modes:**
  - **Normal:** Standard aisle-based grouping
  - **Bulk Buy:** Group by protein type for freezer-stocking trips
  - **Pantry:** Show only shelf-stable items
  - **Quick Trip:** Show only perishables
- **Historical Record:** Each list is saved as a dated file for reference
- **Mobile-Ready:** Designed for checking off items while shopping in Obsidian

---

#### 🌐 The Import (Web Scraper)
**What it does:** Converts recipe URLs into formatted Markdown files.

**The Experience:**
- Paste a URL from AllRecipes, Serious Eats, NYT Cooking, etc.
- Choose a category during import
- Recipe is created with proper frontmatter, ingredients parsed, and image linked
- Bulk import mode for processing multiple URLs at once

---

#### ⚖️ The Scale (Recipe Scaling)
**What it does:** Adjusts ingredient quantities for different serving sizes.

**The Experience:**
- Open a recipe, choose "Scale to X servings"
- See updated quantities instantly (non-destructive preview)
- Copy scaled version if needed

---

## 🏗️ Technical Architecture

### Stack
| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI Framework | React |
| Build Tool | esbuild |
| Data Storage | Markdown files with YAML frontmatter |
| In-Memory State | Services with event emission |

### Architecture Philosophy: Modular from Day One
To avoid the "monolithic main.ts" problem, Mise uses a **service-oriented architecture**:

```
src/
├── main.ts              # Thin orchestrator (just wires things up)
├── types/               # All interfaces (Recipe, MealPlan, etc.)
├── services/            # Business logic (RecipeIndexer, MealPlanService, etc.)
├── parsers/             # Pure parsing functions (IngredientParser, etc.)
├── ui/                  # React components and Obsidian views
└── utils/               # Constants and helpers
```

See `ADR-001-Architecture.md` for full technical details.

### Environment
| Environment | Path |
|-------------|------|
| Development | `C:\Users\bwales\projects\obsidian-plugins\mise` |
| Deployment | `G:\My Drive\IT\Obsidian Vault\My Notebooks\.obsidian\plugins\mise` |
| Recipe Source | `Life/Household/Kitchen/Recipes/` |
| Meal Plans | `Life/Household/Kitchen/Meal Plans/` |
| Shopping Lists | `Life/Household/Shopping Lists/` |

---

## 📊 Data Model

### Recipe
Recipes are Markdown files with YAML frontmatter. The plugin parses:

| Field | Type | Notes |
|-------|------|-------|
| `category` | string | Main, Breakfast, Appetizer, Side, Dessert, Beverage, Snack |
| `tags` | string[] | Freeform tags |
| `rating` | number \| null | 1-5 stars, or "Unrated" |
| `servings` | string | "4" or "8 pancakes" |
| `prep_time` | number | Stored as minutes |
| `cook_time` | number | Stored as minutes |
| `source` | string | Original recipe URL |
| `image` | string | URL or vault path |
| `dietary_flags` | string[] | crohns-safe, low-fiber, high-protein, etc. |

**Body Content:**
- `## 🥘 Ingredients` section (parsed for ingredient list)
- `## 🍳 Instructions` section
- `## 📝 Notes` section

### Meal Plan
Monthly Markdown files with a structured table format:
- Separate tables for Breakfast, Lunch, Dinner
- Days as columns, weeks as sections
- Recipe wikilinks in cells

### Shopping List
Generated Markdown files with:
- Date range header
- Aisle section headers (## 🥬 Produce, ## 🥛 Dairy, etc.)
- Checkbox items with source recipe references

---

## 🎨 Design Principles

### 1. Grandma-Friendly, Power-User Optional
The default experience should be point-and-click intuitive. Advanced features (custom templates, code block editing) are available but not required.

### 2. Mobile-First for Consumption
The cookbook and shopping list will be used primarily on mobile while cooking/shopping. Design decisions prioritize:
- Touch-friendly tap targets (44px minimum)
- Readable text sizes
- Collapsible sections to reduce scrolling
- Swipe gestures where appropriate

### 3. Markdown as Source of Truth
All data remains in human-readable Markdown files. The plugin enhances the experience but doesn't lock data into a proprietary format.

### 4. Event-Driven, Not Tightly Coupled
Integrations with other plugins (like Chronos) should use event systems rather than direct dependencies. Mise emits events; other plugins can subscribe.

---

## 🗺️ Development Approach

### The Strangler Fig Pattern
Rather than building everything before replacing the current system:
1. Build the indexer → retire the Python script
2. Build the cookbook view → retire the Dataview dashboard
3. Build the planner → retire manual meal planning
4. Build the aggregator → retire manual grocery lists

Each phase delivers value and can coexist with the old system.

### Phase Overview

| Phase | Name | Status |
|-------|------|--------|
| 0 | Documentation & Planning | 🔄 In Progress |
| 1 | Foundation & Configuration | ⏳ Not Started |
| 2 | The Silent Indexer | ⏳ Not Started |
| 3 | The Ingredient Parser | ⏳ Not Started |
| 4 | Time Format Migration | ⏳ Not Started |
| 5 | The Cookbook View (UI Skeleton) | ⏳ Not Started |
| 6 | The Recipe Card | ⏳ Not Started |
| 7 | Recipe Quick Look Modal | ⏳ Not Started |
| 8 | Search & Filter Logic | ⏳ Not Started |
| 9 | Meal Plan Reader | ⏳ Not Started |
| 10 | Meal Plan Calendar UI | ⏳ Not Started |
| 11 | Drag-and-Drop Assignment | ⏳ Not Started |
| 12 | Ingredient Aggregator | ⏳ Not Started |
| 13 | Shopping List Writer | ⏳ Not Started |
| 14 | Web Importer | ⏳ Not Started |
| 15 | Recipe Scaling | ⏳ Not Started |
| 16 | Polish & Error Handling | ⏳ Not Started |
| 17 | Nutritional Info | 🔮 Future |
| 18 | Chronos Integration | 🔮 Future |

See `Feature Roadmap.md` for detailed task breakdowns.

---

## 📚 Reference Material

### Existing System
| Resource | Path |
|----------|------|
| Python Indexer | `System/Scripts/index_recipes.py` |
| Current Dashboard | `Life/Household/Kitchen/Cookbook.md` |
| Recipe Index JSON | `Life/Household/Kitchen/Recipes/Recipe_Index.json` |

### Inspiration
| App | What to Learn From |
|-----|-------------------|
| Paprika | Visual recipe cards, scaling UI, grocery list |
| Mealime | Meal planning flow, ingredient aggregation |
| Notion | Clean database views, flexible layouts |
| Obsidian Calendar | Month view UI patterns |

### Sibling Plugins
| Plugin | Relationship |
|--------|--------------|
| Chronos | Potential event-based integration for calendar sync |
| Orbit | Reference for sidebar UI patterns |
| Hover Editor | Works alongside for recipe "quick look" |

---

## 📎 Documentation Index

| Document | Purpose |
|----------|---------|
| `Project Summary.md` | This file—high-level overview and vision |
| `Feature Roadmap.md` | Detailed phase breakdown with task checklists |
| `Handoff Log.md` | Session-by-session implementation notes |
| `CLAUDE.md` | AI assistant instructions and protocols |
| `ADR-001-Architecture.md` | Technical architecture decisions |

---

*Last Updated: January 13, 2026*
