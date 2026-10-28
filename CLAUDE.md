# 2 Forks 1 Spoon

## Problem Statement
Myself and my girlfriend currently meal plan together, this works greate for saving time during the week and making it easy to hit our macros. Our current system involves keeping track of what meal we are each going to eat while at work (sometimes different, sometimes shared) and what meal we will share for dinner. This works, however there are a couple of problems that we have been finding:
- Planning out how many meals a given meal prepped recipe will last can be difficult if we are eating different amounts of a meal each day, it can happen that we run out mid week and have to stay up late to cook on a weekday.
- We go to Costco for most of our groceries once every 2 weeks, and the grocery store once every 2 weeks. It can be hard making sure we get everthing for meals we might be eating in 2-3 weeks time
- It take a long time to add up everthing needed for every meal to add to a grocery list

### Other information about our setup
- We have an obsidian vault that is setup to work with the [obsidian meal plan plugin](https://github.com/tmayoff/obsidian-meals), so everything is stored in the [RecipeMD](https://recipemd.org/) format. However I have found it doesn't really work for us since it is more geared towards people who cook a new lunch and dinner everyday. Another issue is that we don't want to have to both pay for the Obsidian Sycn service since we would have to share the same vault

## Solutions Requirements
- Free to run (free tiers only).
- Works on **one iPhone and one Android phone**, with both of us seeing the same live data and no Obsidian Sync.
- Usable offline (e.g. checking off the grocery list inside Costco with poor signal).
- Portions and yields are measured in **grams**, not servings.
- Imports existing RecipeMD files once. After that the app owns the recipes, and RecipeMD export is kept as an escape hatch.

## Chosen Solution
An installable **PWA** backed by **Firebase** (Firestore + Auth + Hosting, Spark free tier).

### Core concept: plan around batches
- A **Batch** is one cooking session of a recipe: recipe × scale on a cook date. Its weight is `estimatedWeightG` (recipe `expectedYieldG` × scale) until the cooked food is weighed and `actualWeightG` is set, which then overrides the estimate.
- A **meal entry** assigns **grams from a batch** to one person's slot on a date. A shared dinner is one entry per person. Each person has a default portion per slot.
- **Runway** (`forecast.ts`): walks entries in date order and flags *short* (the date it runs out and the grams missing), *surplus*, *past fridge life* (`fridgeDays`, default 4, so freeze those portions) and *empty slots*. Suggested scale = planned grams ÷ `expectedYieldG`, rounded up to 0.5×.
- **Macros** (`macros.ts`): macros per gram = (recipe `macrosTotal` × scale) ÷ batch weight. Daily total = Σ grams × macros per gram, compared with each person's targets.
- **Groceries** (`grocery.ts`): each ingredient goes on the latest upcoming trip at its store (Costco | Grocery | Either) on or before the batch's cook date. Perishables whose `shelfLifeDays` would expire move to a closer trip. Quantities are combined per catalog ingredient, Costco items can be rounded up to whole packs, and pantry staples go in a "check you have" section. A **horizon warning** appears when the plan doesn't extend to the next trip at that store.
- Shopping schedule: Costco every 14 days and Grocery every 14 days, each with an anchor date (configurable).

### Tech stack
React + TypeScript + Vite, Tailwind, `vite-plugin-pwa`, Firebase (Firestore with offline persistence, Google sign-in, Hosting). Tests: Vitest for `src/domain/`, Firebase emulator for security rules.

### Data model (Firestore, under `households/{hid}/`)
- `household` doc: members (uid, name, macro targets, default portion grams per slot), slot definitions, shopping schedule.
- `recipes`: title, description, tags, `expectedYieldG`, ingredient groups `{amount, unit, name, ingredientId}`, instructions (markdown), `macrosTotal` (whole recipe at 1×), `fridgeDays`, raw RecipeMD source.
- `ingredients` (catalog): name, aliases, store, aisle, `shelfLifeDays`, `pantryStaple`, unit conversions (e.g. 1 cup = 120 g), optional pack size.
- `batches`: recipeId, cookDate, scale, `estimatedWeightG`, `actualWeightG?`, status (planned | cooked), frozen grams, notes.
- `mealEntries`: date, slotId, personUid, batchId, `grams`.
- `trips`: date, store, generated items, manual extras, checked state.

Security rules allow access only to the two household members' UIDs.

### Project layout
```
src/
  domain/      recipemd/ (parse, serialize), quantity.ts, forecast.ts, grocery.ts, macros.ts  (+ *.test.ts)
  data/        firebase.ts, typed Firestore repositories/hooks
  features/    plan/, batches/, grocery/, recipes/, settings/
  app/         routing, layout, auth gate
firestore.rules, firebase.json, vite.config.ts
```
Keep `src/domain/` pure TypeScript with no Firebase or React imports, so it stays unit-testable.

### Commands
- `npm run dev`: dev server. Set `VITE_USE_EMULATORS=true` and run `npm run emulators` (needs Java) to work without a real Firebase project.
- `npm test`: domain unit tests. `npm run test:rules`: security rules tests on the emulator.
- `npm run build`, `npm run lint` (oxlint), `npm run deploy`.
- Dates are local `YYYY-MM-DD` strings. Use the helpers in `src/domain/dates.ts`, never `Date` arithmetic.
- Emulator mode always uses the `demo-2-forks-1-spoon` project, even if `.env.local` has the real config.
- Tests get Node types from `tsconfig.test.json`. The app's `tsconfig.app.json` excludes `*.test.ts`.

### Recipe import notes
- `recipes_vault_copy/` is a git-ignored local copy of the Obsidian vault. `src/domain/recipemd/vault.test.ts` parses every recipe in it, and is skipped when the folder isn't there.
- The vault drifts from strict RecipeMD: YAML frontmatter, no `# Title` (the filename is the title), `#hashtag` tags, plain-text yields, ingredient groups as indented plain lines, units outside `*…*`, unicode fractions and NBSPs, and gram hints like `butter (115g)`. `parse.ts` handles all of these, and `serialize.ts` writes strict RecipeMD back out.
- `Ribs.md` has template text pasted into an ingredient, and `Breakfast Sandwich.md` is the unfilled template. The importer flags both.

### Build phases
1. Foundation: scaffold, Tailwind, PWA manifest, Firebase auth + rules, offline persistence.
2. Recipes: RecipeMD parser/serializer, bulk vault import, recipe CRUD, expected yield + macros.
3. Batches + planner + runway: plan grid with default portions, recording cooked weight, forecast + scale suggestions.
4. Ingredient catalog + groceries: unit normalization, trip assignment, shared live checklist, horizon warning.
5. Macros + polish: per-person daily macros, freezer portions, copy-week/templates, Costco pack rounding.
