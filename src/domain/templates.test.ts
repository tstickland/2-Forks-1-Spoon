import { describe, expect, it } from 'vitest'
import { joinChanges, lunchSlotId, newHousehold } from './household'
import { mealEntryId } from './plan'
import { captureWeek, describePattern, instantiateWeek } from './templates'
import type { Batch, Household, MealEntry } from './types'

const base: Household = { id: 'h', ...newHousehold({ uid: 't', name: 'Thomas', email: 't@example.com' }) }
const household: Household = { ...base, ...joinChanges(base, { uid: 'p', name: 'Sam', email: 's@example.com' }) }

const batch = (id: string, recipeId: string, cookDate: string, scale = 1): Batch => ({
  id, recipeId, cookDate, scale, status: 'cooked', frozenG: 500, notes: 'old', actualWeightG: 3000,
})
const meal = (date: string, slotId: string, personUid: string, batchId: string, grams: number): MealEntry => ({
  id: mealEntryId(date, slotId, personUid), date, slotId, personUid, batchId, grams,
})

// Week of Sun 1 Nov: bowls cooked Sunday for both lunches Mon–Tue; soup cooked Sat 31 Oct for Monday dinner.
const batches = [batch('bowls', 'r-bowls', '2026-11-01', 1.5), batch('soup', 'r-soup', '2026-10-31'), batch('other', 'r-x', '2026-10-20')]
const entries = [
  meal('2026-11-02', lunchSlotId('t'), 't', 'bowls', 450),
  meal('2026-11-02', lunchSlotId('p'), 'p', 'bowls', 350),
  meal('2026-11-03', lunchSlotId('t'), 't', 'bowls', 450),
  meal('2026-11-02', 'dinner', 't', 'soup', 500),
  meal('2026-11-09', lunchSlotId('t'), 't', 'bowls', 450), // next week: not part of it
]

describe('captureWeek', () => {
  it('captures the batches used or cooked in the week and its meals, relative to its first day', () => {
    const p = captureWeek('2026-11-01', batches, entries)
    expect(p.batches).toEqual([
      { key: 'soup', recipeId: 'r-soup', scale: 1, cookOffset: -1 },
      { key: 'bowls', recipeId: 'r-bowls', scale: 1.5, cookOffset: 0 },
    ])
    expect(p.meals).toHaveLength(4)
    expect(p.meals[0]).toEqual({ dayOffset: 1, slotId: 'dinner', personUid: 't', batchKey: 'soup', grams: 500 })
    expect(describePattern(p)).toBe('2 batches, 4 meals')
  })
})

describe('instantiateWeek', () => {
  let n = 0
  const newId = () => `new${++n}`

  it('recreates the week a week later with fresh planned batches', () => {
    const p = captureWeek('2026-11-01', batches, entries)
    const { batches: made, entries: meals } = instantiateWeek(p, '2026-11-08', household, newId)
    expect(made.map((b) => [b.recipeId, b.cookDate, b.scale, b.status, b.frozenG, b.actualWeightG])).toEqual([
      ['r-soup', '2026-11-07', 1, 'planned', 0, undefined],
      ['r-bowls', '2026-11-08', 1.5, 'planned', 0, undefined],
    ])
    const bowlsId = made[1].id
    expect(meals.find((m) => m.date === '2026-11-09' && m.personUid === 'p')).toEqual({
      id: mealEntryId('2026-11-09', lunchSlotId('p'), 'p'),
      date: '2026-11-09',
      slotId: lunchSlotId('p'),
      personUid: 'p',
      batchId: bowlsId,
      grams: 350,
    })
    expect(meals).toHaveLength(4)
  })

  it('drops meals for people who left, and batches nobody eats any more', () => {
    const p = captureWeek('2026-11-01', batches, entries)
    const alone: Household = { ...household, members: household.members.filter((m) => m.uid === 't'), slots: household.slots.filter((s) => s.id !== lunchSlotId('p')) }
    const onlySoupPattern = { ...p, meals: p.meals.filter((m) => m.batchKey === 'soup' || m.personUid === 'p') }
    const { batches: made, entries: meals } = instantiateWeek(onlySoupPattern, '2026-11-08', alone, newId)
    expect(meals.map((m) => m.batchId)).toEqual([made[0].id])
    expect(made.map((b) => b.recipeId)).toEqual(['r-soup'])
  })

  it('keeps batches that were cooked but not assigned yet', () => {
    const p = { batches: [{ key: 'k', recipeId: 'r', scale: 1, cookOffset: 0 }], meals: [] }
    expect(instantiateWeek(p, '2026-11-08', household, newId).batches).toHaveLength(1)
  })
})
