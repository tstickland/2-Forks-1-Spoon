import { describe, expect, it } from 'vitest'
import { batchMacrosPerGram, dailyMacros, formatMacros, macrosPer100g, scaleMacros } from './macros'
import type { Batch, MealEntry, Recipe } from './types'

const total = { kcal: 3000, protein: 240, carbs: 300, fat: 90 }

describe('macros', () => {
  it('scales', () => {
    expect(scaleMacros(total, 0.5)).toEqual({ kcal: 1500, protein: 120, carbs: 150, fat: 45 })
  })

  it('gives macros per 100 g of cooked food', () => {
    expect(macrosPer100g(total, 3000)).toEqual({ kcal: 100, protein: 8, carbs: 10, fat: 3 })
    // A batch that cooked down lighter is denser per gram.
    expect(macrosPer100g(total, 2500)!.kcal).toBe(120)
    expect(macrosPer100g(total, 0)).toBeUndefined()
  })

  it('formats', () => {
    expect(formatMacros({ kcal: 519.6, protein: 42.2, carbs: 50, fat: 15.4 })).toBe('520 kcal · 42 P · 50 C · 15 F')
  })
})

const recipe: Recipe = {
  id: 'r1',
  title: 'Bowls',
  description: '',
  tags: [],
  yieldsText: '',
  expectedYieldG: 3000,
  macrosTotal: total,
  ingredientGroups: [],
  instructions: '',
  fridgeDays: 4,
}
const noMacros: Recipe = { ...recipe, id: 'r2', macrosTotal: undefined }
const batch = (id: string, recipeId: string, over: Partial<Batch> = {}): Batch => ({
  id, recipeId, cookDate: '2026-11-01', scale: 1, status: 'planned', frozenG: 0, notes: '', ...over,
})

describe('batchMacrosPerGram', () => {
  it('spreads scaled recipe macros over the batch weight', () => {
    // 2× recipe, estimated 6000 g → same density as the recipe: 1 kcal/g.
    expect(batchMacrosPerGram({ scale: 2 }, recipe)!.kcal).toBeCloseTo(1)
    // Weighed lighter (water cooked off) → denser.
    expect(batchMacrosPerGram({ scale: 2, actualWeightG: 5000 }, recipe)!.kcal).toBeCloseTo(1.2)
  })

  it('is unknown without macros or a weight', () => {
    expect(batchMacrosPerGram({ scale: 1 }, noMacros)).toBeUndefined()
    expect(batchMacrosPerGram({ scale: 1 }, { ...recipe, expectedYieldG: undefined })).toBeUndefined()
  })
})

describe('dailyMacros', () => {
  const batches = new Map([batch('b1', 'r1'), batch('b2', 'r2')].map((b) => [b.id, b]))
  const recipes = new Map([recipe, noMacros].map((r) => [r.id, r]))
  const entries: MealEntry[] = [
    { id: '1', date: '2026-11-02', slotId: 'lunch-t', personUid: 't', batchId: 'b1', grams: 450 },
    { id: '2', date: '2026-11-02', slotId: 'dinner', personUid: 't', batchId: 'b2', grams: 500 },
    { id: '3', date: '2026-11-02', slotId: 'dinner', personUid: 'p', batchId: 'b1', grams: 350 },
  ]

  it('adds up each person’s planned meals and reports grams with unknown macros', () => {
    const [mon, tue] = dailyMacros('t', ['2026-11-02', '2026-11-03'], entries, batches, recipes)
    expect(mon.meals).toBe(2)
    expect(mon.macros.kcal).toBeCloseTo(450)
    expect(mon.macros.protein).toBeCloseTo(36)
    expect(mon.unknownG).toBe(500)
    expect(tue).toEqual({ date: '2026-11-03', macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, unknownG: 0, meals: 0 })
  })

  it('only counts the given person', () => {
    expect(dailyMacros('p', ['2026-11-02'], entries, batches, recipes)[0].macros.kcal).toBeCloseTo(350)
  })
})
