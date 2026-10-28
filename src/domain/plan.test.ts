import { describe, expect, it } from 'vitest'
import { joinChanges, lunchSlotId, newHousehold } from './household'
import { assignSlot, defaultPortion, mealEntryId, slotEntries } from './plan'
import type { Household } from './types'

const base: Household = { id: 'h', ...newHousehold({ uid: 't', name: 'Thomas', email: 't@example.com' }) }
const household: Household = { ...base, ...joinChanges(base, { uid: 'p', name: 'Sam', email: 's@example.com' }) }
const [thomasLunch, , dinner] = household.slots

describe('plan', () => {
  it('uses default portions per person and slot', () => {
    expect(defaultPortion(household, 't', lunchSlotId('t'))).toBe(400)
    expect(defaultPortion(household, 'nobody', 'dinner')).toBe(400)
  })

  it('assigns a personal slot across several days', () => {
    const { set, remove } = assignSlot(household, thomasLunch, ['2026-11-02', '2026-11-03'], {
      batchId: 'b1',
      gramsByPerson: { t: 450 },
    })
    expect(remove).toEqual([])
    expect(set).toEqual([
      { id: mealEntryId('2026-11-02', 'lunch-t', 't'), date: '2026-11-02', slotId: 'lunch-t', personUid: 't', batchId: 'b1', grams: 450 },
      { id: mealEntryId('2026-11-03', 'lunch-t', 't'), date: '2026-11-03', slotId: 'lunch-t', personUid: 't', batchId: 'b1', grams: 450 },
    ])
  })

  it('assigns a shared dinner per person, removing anyone not eating', () => {
    const { set, remove } = assignSlot(household, dinner, ['2026-11-02'], { batchId: 'b1', gramsByPerson: { t: 500 } })
    expect(set.map((e) => [e.personUid, e.grams])).toEqual([['t', 500]])
    expect(remove).toEqual([mealEntryId('2026-11-02', 'dinner', 'p')])
  })

  it('clears a slot', () => {
    expect(assignSlot(household, dinner, ['2026-11-02'], null)).toEqual({
      set: [],
      remove: [mealEntryId('2026-11-02', 'dinner', 't'), mealEntryId('2026-11-02', 'dinner', 'p')],
    })
  })

  it('finds the entries in a cell', () => {
    const { set } = assignSlot(household, dinner, ['2026-11-02'], { batchId: 'b1', gramsByPerson: { t: 500, p: 350 } })
    const cell = slotEntries(set, '2026-11-02', 'dinner')
    expect(cell.get('p')?.grams).toBe(350)
    expect(slotEntries(set, '2026-11-03', 'dinner').size).toBe(0)
  })
})
