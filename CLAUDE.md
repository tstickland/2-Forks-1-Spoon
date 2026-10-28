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

### Conventions
- Keep `src/domain/` pure TypeScript with no Firebase or React imports, so it stays unit-testable.
- Dates are local `YYYY-MM-DD` strings. Use the helpers in `src/domain/dates.ts`, never `Date` arithmetic.
- To work without a real Firebase project: set `VITE_USE_EMULATORS=true` for `npm run dev` and run `npm run emulators` (needs Java).
- Emulator mode always uses the `demo-2-forks-1-spoon` project, even if `.env.local` has the real config.

### Planning notes
- The plan grid shows 2 weeks starting on **Sunday**, matching the couple's Obsidian meal plan. Use `startOfWeek(date, 'sunday')`.
- Meal entry ids are `${date}_${slotId}_${personUid}` (`mealEntryId` in `src/domain/plan.ts`): one entry per person per slot per day, so writes are idempotent.
- `usePlanData()` loads recipes, batches and the last 60 days of meal entries, and computes every batch's forecast in one place. Pages use it rather than computing forecasts themselves.
- Recording a batch's cooked weight can also set the recipe's `expectedYieldG` (weight ÷ scale). That's how recipes without a yield get one.
- **Freezer:** `batch.frozenG` is grams put in the freezer. Meals after `fridgeUntil` draw from it. The forecast's `freezeMoreG` is what still needs freezing, and `freezerLeftG` is frozen food not yet planned (shown under "In the freezer" on Batches).
- **Repeat last week and templates** both go through `captureWeek` → `instantiateWeek`. These create *new* planned batches (same recipe and scale, cook day shifted) rather than reusing old ones, because last week's batch would be past fridge life.
- **Macros** (`/macros`) are per person from planned meals only (lunch and dinner). "Left" under a target is room for unplanned breakfast and snacks.
- Firestore writes from the UI aren't awaited before navigating. The local cache applies them immediately, which keeps the app usable offline.

### Grocery notes
- `trips` docs (id `${store}_${date}`) store only `checked` (item key → bool) and `extras` (items added by hand). The list itself is generated from the plan each time (`buildGroceryPlan`), so it always matches the current plan.
- Only batches with status `planned` and a cook date from today onward go on lists. Cooked batches are already bought.
- Items match across recipes by `ingredientKey()` (lowercase, prep and size words removed, last word singular), then through catalog names and aliases. "Same as…" in the ingredient sheet adds an alias.
- Item keys for ticking off are `c:<catalog id>` once set up and `k:<ingredient key>` before. Extras are `x:<id>`. Ticks are merged writes per key, so two phones can tick at once, even offline.
- Items not set up get a guessed aisle (`guessAisle`) and staple flag (`guessStaple`), and buy at "Either" store. Water and ice are never listed.
- When writing regexes through a shell heredoc, `\b` can turn into a backspace character. Edit regex-bearing code with the file editor.
