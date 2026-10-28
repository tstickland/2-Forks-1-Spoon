import { batchWeight } from './batch'
import type { Batch, IsoDate, Macros, MealEntry, Recipe } from './types'

export const MACRO_KEYS: (keyof Macros)[] = ['kcal', 'protein', 'carbs', 'fat']

export function scaleMacros(m: Macros, factor: number): Macros {
  return { kcal: m.kcal * factor, protein: m.protein * factor, carbs: m.carbs * factor, fat: m.fat * factor }
}

/** Macros per 100 g of cooked food, from whole-recipe macros and the cooked weight. */
export function macrosPer100g(total: Macros, cookedWeightG: number): Macros | undefined {
  if (!(cookedWeightG > 0)) return undefined
  return scaleMacros(total, 100 / cookedWeightG)
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/**
 * Macros per gram of a batch: the recipe's whole-recipe macros × scale, spread over the batch's
 * cooked weight (measured if weighed, else estimated). Undefined without macros or a weight.
 */
export function batchMacrosPerGram(batch: Pick<Batch, 'scale' | 'actualWeightG'>, recipe?: Pick<Recipe, 'macrosTotal' | 'expectedYieldG'>): Macros | undefined {
  const weight = batchWeight(batch, recipe)
  if (!recipe?.macrosTotal || !weight || weight.grams <= 0) return undefined
  return scaleMacros(recipe.macrosTotal, batch.scale / weight.grams)
}

export interface DayMacros {
  date: IsoDate
  /** From planned meals that have macros. */
  macros: Macros
  /** Planned grams whose macros are unknown (recipe has no macros, or no weight). */
  unknownG: number
  meals: number
}

/** A person's macros per day from their planned meals. */
export function dailyMacros(
  personUid: string,
  dates: IsoDate[],
  entries: MealEntry[],
  batchById: Map<string, Batch>,
  recipeById: Map<string, Recipe>,
): DayMacros[] {
  const perGram = new Map<string, Macros | undefined>()
  const macrosFor = (batchId: string) => {
    if (!perGram.has(batchId)) {
      const batch = batchById.get(batchId)
      perGram.set(batchId, batch && batchMacrosPerGram(batch, recipeById.get(batch.recipeId)))
    }
    return perGram.get(batchId)
  }
  return dates.map((date) => {
    const day: DayMacros = { date, macros: ZERO_MACROS, unknownG: 0, meals: 0 }
    for (const e of entries) {
      if (e.date !== date || e.personUid !== personUid) continue
      day.meals += 1
      const m = macrosFor(e.batchId)
      if (m) day.macros = addMacros(day.macros, scaleMacros(m, e.grams))
      else day.unknownG += e.grams
    }
    return day
  })
}

/** "520 kcal · 42 P · 50 C · 15 F" */
export function formatMacros(m: Macros): string {
  return `${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} P · ${Math.round(m.carbs)} C · ${Math.round(m.fat)} F`
}
