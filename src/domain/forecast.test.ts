import { describe, expect, it } from 'vitest'
import { dateRange } from './dates'
import { forecastBatch, forecastProblems } from './forecast'
import type { Batch, MealEntry, Recipe } from './types'

const recipe: Recipe = {
  id: 'r1',
  title: 'Burrito bowls',
  description: '',
  tags: [],
  yieldsText: '',
  expectedYieldG: 2400,
  ingredientGroups: [],
  instructions: '',
  fridgeDays: 4,
}

// Cooked Sunday 1 Nov 2026 at 1.25× → 3000 g estimated.
const batch: Batch = { id: 'b1', recipeId: 'r1', cookDate: '2026-11-01', scale: 1.25, status: 'planned', frozenG: 0, notes: '' }

function lunches(person: string, grams: number, from: string, to: string, batchId = 'b1'): MealEntry[] {
  return dateRange(from, to).map((date) => ({ id: `${date}-${person}`, date, slotId: `lunch-${person}`, personUid: person, batchId, grams }))
}

// Thomas 450 g + partner 350 g, Monday–Friday = 4000 g planned.
const weekdays = [...lunches('t', 450, '2026-11-02', '2026-11-06'), ...lunches('p', 350, '2026-11-02', '2026-11-06')]

describe('forecastBatch', () => {
  it('finds the day a batch runs out and suggests a scale that covers the plan', () => {
    const f = forecastBatch(batch, recipe, weekdays)
    expect(f.weightG).toBe(3000)
    expect(f.estimated).toBe(true)
    expect(f.plannedG).toBe(4000)
    expect(f.remainingG).toBe(-1000)
    expect(f.days.map((d) => d.remainingG)).toEqual([2200, 1400, 600, -200, -1000])
    expect(f.shortOn).toEqual({ date: '2026-11-05', missingG: 200 }) // Thursday
    expect(f.days[4].plannedG).toBe(800) // Friday entirely uncovered
    expect(f.suggestedScale).toBe(2) // 4000 / 2400 = 1.67 → 2×
  })

  it('flags meals past fridge life (cooked Sunday, 4 days → Friday is too late)', () => {
    const f = forecastBatch(batch, recipe, weekdays)
    expect(f.fridgeUntil).toBe('2026-11-05')
    expect(f.pastFridgeLife).toEqual([{ date: '2026-11-06', grams: 800 }])
    expect(f.freezeMoreG).toBe(800)
  })

  it('counts frozen portions: covers late meals and shows what is left in the freezer', () => {
    const big: Batch = { ...batch, scale: 2 } // 4800 g, 4000 g planned
    expect(forecastBatch({ ...big, frozenG: 500 }, recipe, weekdays).freezeMoreG).toBe(300)
    const covered = forecastBatch({ ...big, frozenG: 1500 }, recipe, weekdays)
    expect(covered.freezeMoreG).toBe(0)
    expect(covered.freezerLeftG).toBe(700) // 1500 frozen − 800 planned from it
    expect(forecastProblems(covered)).toEqual([])
    // Never more in the freezer than is left of the batch.
    expect(forecastBatch({ ...big, frozenG: 3000 }, recipe, weekdays).freezerLeftG).toBe(800)
  })

  it('uses the measured weight once recorded, and stops suggesting a scale', () => {
    const cooked: Batch = { ...batch, actualWeightG: 4200, status: 'cooked' }
    const f = forecastBatch(cooked, recipe, weekdays)
    expect(f.weightG).toBe(4200)
    expect(f.estimated).toBe(false)
    expect(f.remainingG).toBe(200)
    expect(f.shortOn).toBeUndefined()
    expect(f.suggestedScale).toBeUndefined()
  })

  it('does not suggest a scale when the batch already covers the plan', () => {
    const f = forecastBatch({ ...batch, scale: 2 }, recipe, weekdays)
    expect(f.remainingG).toBe(800)
    expect(f.suggestedScale).toBeUndefined()
  })

  it('only counts entries from this batch', () => {
    const other = lunches('t', 450, '2026-11-02', '2026-11-03', 'b2')
    expect(forecastBatch(batch, recipe, [...weekdays, ...other]).plannedG).toBe(4000)
  })

  it('flags meals planned before the cook date', () => {
    const early = lunches('t', 450, '2026-10-31', '2026-10-31')
    expect(forecastBatch(batch, recipe, early).beforeCooked).toEqual([{ date: '2026-10-31', grams: 450 }])
  })

  it('reports an unknown runway when the recipe has no yield and nothing was weighed', () => {
    const f = forecastBatch(batch, { ...recipe, expectedYieldG: undefined }, weekdays)
    expect(f.weightG).toBeUndefined()
    expect(f.remainingG).toBeUndefined()
    expect(f.shortOn).toBeUndefined()
    expect(f.suggestedScale).toBeUndefined()
    expect(forecastProblems(f)[0]).toContain('No cooked weight')
  })

  it('describes problems in plain language', () => {
    expect(forecastProblems(forecastBatch(batch, recipe, weekdays))).toEqual([
      'Runs out Thu 5 Nov: short 200 g that day.',
      'Freeze 800 g by Thu 5 Nov (1 day planned after then).',
    ])
    expect(forecastProblems(forecastBatch({ ...batch, scale: 2 }, recipe, weekdays.filter((e) => e.date < '2026-11-06')))).toEqual([])
  })
})
