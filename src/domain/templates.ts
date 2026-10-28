// Reusing a week: "repeat last week" and saved templates both capture a week as a pattern of
// batches and meals relative to its first day, then recreate it on another week.

import { addDays, daysBetween } from './dates'
import { slotEaters } from './household'
import { mealEntryId } from './plan'
import type { Batch, Household, IsoDate, MealEntry } from './types'

export interface TemplateBatch {
  /** Links the template's meals to this batch. */
  key: string
  recipeId: string
  scale: number
  /** Cook day relative to the week's first day (can be negative: cooked the Saturday before). */
  cookOffset: number
}

export interface TemplateMeal {
  dayOffset: number
  slotId: string
  personUid: string
  batchKey: string
  grams: number
}

export interface WeekPattern {
  batches: TemplateBatch[]
  meals: TemplateMeal[]
}

export interface WeekTemplate extends WeekPattern {
  id: string
  name: string
}

/** The batches cooked or eaten in the week starting `weekStart`, and every meal in it. */
export function captureWeek(weekStart: IsoDate, batches: Batch[], entries: MealEntry[]): WeekPattern {
  const weekEnd = addDays(weekStart, 6)
  const inWeek = (d: IsoDate) => d >= weekStart && d <= weekEnd
  const meals = entries.filter((e) => inWeek(e.date))
  const used = new Set(meals.map((e) => e.batchId))
  const kept = batches.filter((b) => used.has(b.id) || inWeek(b.cookDate))
  const keptIds = new Set(kept.map((b) => b.id))
  return {
    batches: kept
      .map((b) => ({ key: b.id, recipeId: b.recipeId, scale: b.scale, cookOffset: daysBetween(weekStart, b.cookDate) }))
      .sort((a, b) => a.cookOffset - b.cookOffset),
    meals: meals
      .filter((e) => keptIds.has(e.batchId))
      .map((e) => ({ dayOffset: daysBetween(weekStart, e.date), slotId: e.slotId, personUid: e.personUid, batchKey: e.batchId, grams: e.grams }))
      .sort((a, b) => a.dayOffset - b.dayOffset || a.slotId.localeCompare(b.slotId)),
  }
}

/**
 * New batches and meal entries that recreate a pattern on the week starting `weekStart`.
 * Meals for slots or people no longer in the household are dropped.
 */
export function instantiateWeek(
  pattern: WeekPattern,
  weekStart: IsoDate,
  household: Pick<Household, 'members' | 'slots'>,
  newId: () => string,
): { batches: Batch[]; entries: MealEntry[] } {
  const idByKey = new Map<string, string>()
  const batches = pattern.batches.map((t): Batch => {
    const id = newId()
    idByKey.set(t.key, id)
    return { id, recipeId: t.recipeId, cookDate: addDays(weekStart, t.cookOffset), scale: t.scale, status: 'planned', frozenG: 0, notes: '' }
  })
  const entries = pattern.meals.flatMap((m): MealEntry[] => {
    const slot = household.slots.find((s) => s.id === m.slotId)
    const batchId = idByKey.get(m.batchKey)
    if (!slot || !batchId || !slotEaters(household, slot).some((p) => p.uid === m.personUid)) return []
    const date = addDays(weekStart, m.dayOffset)
    return [{ id: mealEntryId(date, m.slotId, m.personUid), date, slotId: m.slotId, personUid: m.personUid, batchId, grams: m.grams }]
  })
  // Keep a batch if a meal still uses it, or if it never had meals (cooked but not yet assigned).
  // Drop batches whose every meal was dropped above.
  const usedIds = new Set(entries.map((e) => e.batchId))
  const hadMeals = new Set(pattern.meals.map((m) => idByKey.get(m.batchKey)))
  return { batches: batches.filter((b) => usedIds.has(b.id) || !hadMeals.has(b.id)), entries }
}

/** "2 batches, 10 meals" */
export function describePattern(p: WeekPattern): string {
  const b = p.batches.length
  const m = p.meals.length
  return `${b} batch${b === 1 ? '' : 'es'}, ${m} meal${m === 1 ? '' : 's'}`
}
