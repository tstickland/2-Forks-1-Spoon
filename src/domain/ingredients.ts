// Matching ingredient lines from different recipes to the same thing to buy, and sensible guesses
// for items nobody has set up in the catalog yet.

import type { CatalogIngredient } from './types'

// Preparation and size words that don't change what you buy: "garlic cloves minced" → "garlic clove".
const PREP_WORDS = new Set([
  'chopped', 'finely', 'thinly', 'roughly', 'diced', 'minced', 'sliced', 'pressed', 'crushed', 'juiced', 'zested',
  'ripe', 'extra', 'large', 'medium', 'small', 'fresh', 'freshly', 'freshly-cracked', 'cracked', 'divided',
  'melted', 'softened', 'warmed', 'packed', 'cubed', 'peeled', 'rinsed', 'drained', 'optional',
])

function singular(word: string): string {
  if (/ies$/.test(word) && word.length > 4) return `${word.slice(0, -3)}y`
  if (/(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  if (/[^s]s$/.test(word) && word.length > 3) return word.slice(0, -1)
  return word
}

/**
 * A normalised name used to recognise the same ingredient across recipes:
 * "Chicken breasts" / "chicken breast" / "diced chicken breast" → "chicken breast".
 */
export function ingredientKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "(reduce)", "(e.g. Kahlua)"
    .split(',')[0] // "garlic, pressed or minced"
    .replace(/\bto taste\b/g, ' ')
    .replace(/[^a-z0-9&%/' -]/g, ' ')
  const words = base.split(/\s+/).filter((w) => w && !PREP_WORDS.has(w))
  if (words.length === 0) return name.trim().toLowerCase()
  words[words.length - 1] = singular(words[words.length - 1])
  return words.join(' ')
}

/** Look up catalog items by their name and aliases, both normalised. */
export function catalogIndex(catalog: CatalogIngredient[]): Map<string, CatalogIngredient> {
  const index = new Map<string, CatalogIngredient>()
  for (const item of catalog) {
    for (const name of [item.name, ...item.aliases]) index.set(ingredientKey(name), item)
  }
  return index
}

/** Things never worth putting on a shopping list. */
export function isFree(key: string): boolean {
  return /^(water|ice|cold water|warm water|hot water|ice cube)$/.test(key)
}

const AISLE_GUESSES: [RegExp, string][] = [
  // First, so "chicken stock" and "cream of chicken soup" aren't filed as meat.
  [/\b(stock|broth|soup|bouillon)\b/, 'Sauces & oils'],
  [/\b(chicken|beef|pork|turkey|salmon|fish|shrimp|rib|bacon|sausage|ham|steak|lamb|pepperoni)\b/, 'Meat & fish'],
  [/\b(cheese|cheddar|mozzarella|parmesan|feta|brie|cotija|milk|yogurt|butter|cream|egg|rumchata)\b/, 'Dairy & eggs'],
  [/\bprotein powder\b/, 'Pantry'],
  // Before produce, so "garlic powder" isn't filed with garlic.
  [/\b(powder|seasoning|flake|garam masala|paprika|cumin|cinnamon|cayenne|ground \w+|dried \w+)\b/, 'Spices'],
  [
    /\b(onion|garlic|broccoli|bell pepper|jalapeno|cucumber|lemon|lime|carrot|bok choy|spinach|banana|apple|berry|lettuce|tomato|potato|bean sprout|green onion|spring onion|cilantro|ginger|avocado|mushroom|zucchini|celery|fruit|corn on)\b/,
    'Produce',
  ],
  [/\b(frozen)\b/, 'Frozen'],
  [/\b(bread|tortilla|wrap|bun|bagel|pita)\b/, 'Bakery'],
  // Before the general spice rule, so "sweet chili sauce" isn't filed as a spice.
  [/\b(oil|vinegar|sauce|mayo|mustard|honey|syrup|sriracha|ketchup|broth|stock|paste|marinara|soup)\b/, 'Sauces & oils'],
  [
    /\b(salt|pepper|oregano|thyme|coriander|cardamon|cardamom|parsley|basil|nutmeg|chili)\b/,
    'Spices',
  ],
  [/\b(rice|pasta|macaroni|noodle|udon|lasagna|quinoa|oat|bean|flour|sugar|panko|bread crumb|corn meal|cornmeal|starch|baking|chocolate|chip|furikake)\b/, 'Pantry'],
  [/\b(vodka|gin|liquor|liqueur|rum|wine|beer|espresso|coffee|juice)\b/, 'Drinks'],
]

/** A best-guess aisle for an item that isn't in the catalog yet. */
export function guessAisle(key: string): string {
  return AISLE_GUESSES.find(([re]) => re.test(key))?.[1] ?? 'Other'
}

// Long-lasting basics most kitchens already have: listed under "check you have", not to buy.
const STAPLE =
  /^(kosher |sea |table |flaky )?salt$|^(black |ground black |white )?pepper$|^salt & pepper$|^salt and pepper$|\b(garlic powder|onion powder|paprika|smoked paprika|cumin|ground cumin|dried oregano|oregano|thyme|cinnamon|italian seasoning|chili powder|red pepper flake|garam masala|ground coriander|cayenne|cayenne pepper|dried parsley|baking powder|baking soda|vanilla extract|olive oil|sesame oil|vegetable oil|cooking spray|soy sauce|rice vinegar|rice wine vinegar|corn starch|cornstarch|all purpose flour|all-purpose flour|ap flour|white sugar|brown sugar|light brown sugar)$/

export function guessStaple(key: string): boolean {
  return STAPLE.test(key)
}
