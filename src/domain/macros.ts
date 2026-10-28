import type { Macros } from './types'

export const MACRO_KEYS: (keyof Macros)[] = ['kcal', 'protein', 'carbs', 'fat']

export function scaleMacros(m: Macros, factor: number): Macros {
  return { kcal: m.kcal * factor, protein: m.protein * factor, carbs: m.carbs * factor, fat: m.fat * factor }
}

/** Macros per 100 g of cooked food, from whole-recipe macros and the cooked weight. */
export function macrosPer100g(total: Macros, cookedWeightG: number): Macros | undefined {
  if (!(cookedWeightG > 0)) return undefined
  return scaleMacros(total, 100 / cookedWeightG)
}

/** "520 kcal · 42 P · 50 C · 15 F" */
export function formatMacros(m: Macros): string {
  return `${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} P · ${Math.round(m.carbs)} C · ${Math.round(m.fat)} F`
}
