// Reading amounts like "1 ½ cups", "1-2 tbsp", "3 Ibs" or "60ml" as written in recipes.

export interface Quantity {
  value: number
  /** Upper bound for ranges like "1-2 tbsp" or "1/2 to 1 cup". */
  max?: number
  /** Canonical unit (see UNIT_ALIASES) or the unrecognised unit text as written. */
  unit?: string
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5',
  '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
}

const UNIT_ALIASES: Record<string, string[]> = {
  g: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  oz: ['oz', 'ounce', 'ounces'],
  // "Ib"/"Ibs" (capital i) is a common typo for lb.
  lb: ['lb', 'lbs', 'pound', 'pounds', 'ib', 'ibs'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  tbsp: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons'],
  cup: ['cup', 'cups'],
  'fl oz': ['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans', 'tin', 'tins'],
  jar: ['jar', 'jars'],
  head: ['head', 'heads'],
  slice: ['slice', 'slices'],
  rack: ['rack', 'racks'],
  pack: ['pack', 'packs', 'package', 'packages', 'packet', 'packets'],
  bunch: ['bunch', 'bunches'],
  piece: ['piece', 'pieces'],
  filet: ['filet', 'filets', 'fillet', 'fillets'],
  serving: ['serving', 'servings', 'portion', 'portions'],
}

const CANONICAL_UNIT = new Map<string, string>(
  Object.entries(UNIT_ALIASES).flatMap(([canon, aliases]) => aliases.map((a) => [a, canon] as const)),
)

const GRAMS_PER: Record<string, number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 }

/** Replace non-breaking spaces and unicode fractions; collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .replace(/[   ]/g, ' ')
    .replace(/(\d)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, digit: string | undefined, frac: string) =>
      digit ? `${digit} ${UNICODE_FRACTIONS[frac]}` : UNICODE_FRACTIONS[frac],
    )
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The canonical unit for a word like "Tablespoons" or "lbs.", or undefined if it isn't a known unit. */
export function canonicalUnit(word: string): string | undefined {
  return CANONICAL_UNIT.get(word.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' '))
}

/** True for canonical units this module knows (as returned by parseQuantity), false for free text. */
export function isKnownUnit(unit: string | undefined): boolean {
  return unit !== undefined && unit in UNIT_ALIASES
}

export function isMassUnit(unit: string | undefined): boolean {
  return unit !== undefined && unit in GRAMS_PER
}

/** Grams for a mass quantity (ranges use the upper bound, so shopping errs on having enough). */
export function toGrams(q: Quantity): number | undefined {
  if (!q.unit || !isMassUnit(q.unit)) return undefined
  return (q.max ?? q.value) * GRAMS_PER[q.unit]
}

// "1 1/2", "3/2", "1.5", "2" — mixed number must come first so "1 1/2" isn't read as "1".
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+)`
const LEADING = new RegExp(String.raw`^~?\s*(${NUMBER})(?:\s*(?:-|to)\s*(${NUMBER}))?\s*`, 'i')

function numberValue(text: string): number {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = text.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  return Number(text)
}

/**
 * Parse an amount such as "1 ½ cups", "1-2 tbsp", "60ml", "3 Ibs" or "2 15 oz cans".
 * Returns undefined when the text doesn't start with a number (e.g. "Costco pack").
 * Bracketed notes are ignored for the unit: "3 cups (4 ounces)" is 3 cups.
 */
export function parseQuantity(text: string): Quantity | undefined {
  const s = normalizeText(text)
  const m = s.match(LEADING)
  if (!m) return undefined
  const value = numberValue(m[1])
  const max = m[2] !== undefined ? numberValue(m[2]) : undefined
  const unitText = s
    .slice(m[0].length)
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const q: Quantity = { value }
  if (max !== undefined && max > value) q.max = max
  if (unitText) q.unit = canonicalUnit(unitText) ?? unitText
  return q
}

/**
 * A mass mentioned in brackets, as in "butter (115g)", "cheddar (~900g)" or "3 cups (4 ounces)".
 * Returns the grams and the text with that bracket removed.
 */
export function extractMassHint(text: string): { grams?: number; text: string } {
  const re = /\s*\(\s*~?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+\.?)\s*\)/
  const m = text.match(re)
  if (!m) return { text }
  const unit = canonicalUnit(m[2])
  if (!isMassUnit(unit)) return { text }
  return { grams: Number(m[1]) * GRAMS_PER[unit!], text: text.replace(re, '').trim() }
}

/** Round to at most 2 decimals and print without trailing zeros. */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}
