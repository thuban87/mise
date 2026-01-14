---
tags:
  - projects
  - active
  - mise
  - docs
  - adr
---
# ADR-001: Plugin Architecture

**Status:** Accepted
**Date:** January 13, 2026
**Decision Makers:** Brad (PM), Claude (Dev)

---

## Context

Mise is an Obsidian plugin that will grow to include multiple features: real-time indexing, visual UI, meal planning, shopping lists, and web importing. Many Obsidian plugins start with all logic in `main.ts` and become difficult to maintain and extend as they grow.

Brad has experience with this pain point from other plugins and explicitly requested a modular architecture from day one to avoid costly refactoring later.

## Decision

We will use a **service-oriented architecture** with clear separation of concerns:

1. **`main.ts`** is a thin orchestrator that only:
   - Instantiates services
   - Registers commands and views
   - Wires dependencies together
   - Contains no business logic

2. **Services** are singleton classes that:
   - Own specific domains (indexing, meal planning, shopping lists)
   - Emit events for state changes
   - Are injected into UI components as needed

3. **Parsers** are pure functions that:
   - Take input, return output
   - Have no side effects
   - Are easy to unit test

4. **UI Components** are React components that:
   - Receive data via props or context
   - Emit events for user actions
   - Handle presentation only

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                           main.ts                                 │
│                    (Thin Orchestrator)                           │
│  - Instantiates services                                         │
│  - Registers commands, views, settings                           │
│  - Wires dependencies                                            │
└─────────────────────────────┬────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ RecipeIndexer   │ │ MealPlanService │ │ ShoppingList    │
│ Service         │ │                 │ │ Service         │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • scanVault()   │ │ • readPlan()    │ │ • aggregate()   │
│ • watchFiles()  │ │ • writePlan()   │ │ • generateFile()│
│ • getRecipes()  │ │ • getPlan()     │ │ • getList()     │
│ • emit events   │ │ • emit events   │ │ • emit events   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                              │
                    Uses (pure functions)
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ IngredientParser│ │ FrontmatterPars.│ │ MealPlanParser  │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • parseBody()   │ │ • parseTime()   │ │ • parseMonth()  │
│ • cleanLine()   │ │ • normalize()   │ │ • parseDays()   │
│ • extractList() │ │ • validate()    │ │ • parseLinks()  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                    Consumed by
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│           UI Layer              │ │         Settings Tab            │
│  (React Components in ItemView) │ │    (Obsidian PluginSettingTab)  │
├─────────────────────────────────┤ ├─────────────────────────────────┤
│ • CookbookView                  │ │ • Path pickers                  │
│ • RecipeGrid                    │ │ • Toggle switches               │
│ • RecipeCard                    │ │ • Aisle configuration           │
│ • RecipeModal                   │ │                                 │
│ • FilterBar                     │ │                                 │
│ • MealCalendar                  │ │                                 │
└─────────────────────────────────┘ └─────────────────────────────────┘
```

## Folder Structure

```
mise/
├── src/
│   ├── main.ts                      # Plugin entry point (thin)
│   │
│   ├── types/
│   │   └── index.ts                 # All TypeScript interfaces
│   │
│   ├── services/
│   │   ├── RecipeIndexer.ts         # File watching, caching, events
│   │   ├── MealPlanService.ts       # Meal plan read/write
│   │   ├── ShoppingListService.ts   # Aggregation, file generation
│   │   └── ImporterService.ts       # Web scraping, file creation
│   │
│   ├── parsers/
│   │   ├── IngredientParser.ts      # Extract ingredients from body
│   │   ├── FrontmatterParser.ts     # Normalize metadata
│   │   ├── MealPlanParser.ts        # Parse meal plan markdown
│   │   └── QuantityParser.ts        # Parse ingredient quantities
│   │
│   ├── ui/
│   │   ├── views/
│   │   │   ├── CookbookView.tsx     # Full-tab ItemView wrapper
│   │   │   └── CookbookSidebar.tsx  # Sidebar panel wrapper
│   │   │
│   │   ├── components/
│   │   │   ├── RecipeCard.tsx       # Individual recipe card
│   │   │   ├── RecipeGrid.tsx       # Grid container
│   │   │   ├── RecipeModal.tsx      # Quick look modal
│   │   │   ├── FilterBar.tsx        # Search and filters
│   │   │   ├── MealCalendar.tsx     # Month calendar view
│   │   │   └── DayCell.tsx          # Drop target for drag-and-drop
│   │   │
│   │   └── settings/
│   │       └── MiseSettingsTab.ts   # Obsidian settings UI
│   │
│   └── utils/
│       ├── constants.ts             # Magic strings, defaults
│       └── helpers.ts               # Pure utility functions
│
├── styles.css                       # Plugin styles
├── manifest.json                    # Obsidian plugin manifest
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

## Service Communication

Services communicate via an event system rather than direct coupling:

```typescript
// RecipeIndexer emits events
this.events.emit('recipe-added', recipe);
this.events.emit('recipe-updated', recipe);
this.events.emit('recipe-deleted', path);

// UI components subscribe
indexer.events.on('recipe-added', (recipe) => {
  setRecipes(prev => [...prev, recipe]);
});
```

This pattern:
- Allows UI to react to data changes without polling
- Enables future plugin integrations (e.g., Chronos) via same event system
- Makes testing easier (mock event emissions)

## Consequences

### Positive
- **Maintainability:** Changes to one feature don't affect others
- **Testability:** Pure parsers can be unit tested in isolation
- **Extendability:** New features (nutritional info, scaling) are new modules
- **Clarity:** Easy to find where specific logic lives
- **Onboarding:** New developers can understand one service at a time

### Negative
- **Initial Overhead:** More files to create upfront
- **Boilerplate:** Event wiring requires some setup code
- **Import Management:** More imports to manage (mitigated by barrel exports)

### Neutral
- **Learning Curve:** Requires understanding the service pattern (well-documented)

## Alternatives Considered

### 1. Monolithic main.ts
**Rejected:** Brad has experienced the pain of refactoring monolithic plugins. The upfront cost of modular architecture is lower than the refactoring cost later.

### 2. MVC Pattern
**Partially Adopted:** We use services (similar to controllers) but without formal model classes. The `Recipe` interface + parser functions serve the model role.

### 3. Redux/Global State
**Rejected for Now:** For ~150 recipes and single-user, React state + service events is sufficient. If performance becomes an issue at scale, we can add a state management layer.

## Implementation Notes

### Service Initialization (main.ts)
```typescript
export default class MisePlugin extends Plugin {
  indexer: RecipeIndexer;
  mealPlanService: MealPlanService;
  shoppingListService: ShoppingListService;

  async onload() {
    await this.loadSettings();
    
    // Initialize services
    this.indexer = new RecipeIndexer(this.app, this.settings);
    this.mealPlanService = new MealPlanService(this.app, this.settings, this.indexer);
    this.shoppingListService = new ShoppingListService(this.app, this.settings, this.indexer);
    
    // Register views
    this.registerView(COOKBOOK_VIEW_TYPE, (leaf) => 
      new CookbookView(leaf, this.indexer)
    );
    
    // Start indexer
    await this.indexer.initialize();
    
    console.log('Mise loaded');
  }

  async onunload() {
    this.indexer.destroy();
    console.log('Mise unloaded');
  }
}
```

### Dependency Injection
Services receive dependencies via constructor:
```typescript
class MealPlanService {
  constructor(
    private app: App,
    private settings: MiseSettings,
    private indexer: RecipeIndexer  // Can access recipe data
  ) {}
}
```

This makes dependencies explicit and testable (pass mock objects in tests).

---

## Related Decisions

- **ADR-002:** (Future) UI Framework Choice (React vs Svelte)
- **ADR-003:** (Future) State Management Strategy

---

*This ADR documents why we chose this architecture. It should be updated if the architecture fundamentally changes.*
