import { describe, expect, it } from 'vitest'
import { DINNER_SLOT_ID, joinChanges, lunchSlotId, newHousehold, slotEaters } from './household'
import type { Household } from './types'

const thomas = { uid: 't1', name: 'Thomas Stickland', email: 'Thomas@Example.com' }
const partner = { uid: 'p1', name: 'Sam', email: 'sam@example.com' }

describe('household', () => {
  it('creates a household with a lunch slot, a shared dinner and a staggered schedule', () => {
    const h = newHousehold(thomas, new Date(2026, 10, 1))
    expect(h.memberUids).toEqual(['t1'])
    expect(h.members[0].email).toBe('thomas@example.com')
    expect(h.slots.map((s) => s.id)).toEqual([lunchSlotId('t1'), DINNER_SLOT_ID])
    expect(h.slots[0].name).toBe("Thomas's lunch")
    expect(h.schedule).toEqual([
      { store: 'Costco', everyDays: 14, anchorDate: '2026-11-01' },
      { store: 'Grocery', everyDays: 14, anchorDate: '2026-11-08' },
    ])
  })

  it('adds a joining member and their lunch slot before dinner', () => {
    const h: Household = { id: 'h', ...newHousehold(thomas) }
    const changes = joinChanges(h, partner)
    expect(changes.memberUids).toEqual(['t1', 'p1'])
    expect(changes.slots.map((s) => s.id)).toEqual([lunchSlotId('t1'), lunchSlotId('p1'), DINNER_SLOT_ID])
    expect(changes.members[1].defaultPortionG[lunchSlotId('p1')]).toBeGreaterThan(0)
  })

  it('is idempotent when the member already belongs', () => {
    const h: Household = { id: 'h', ...newHousehold(thomas) }
    expect(joinChanges(h, thomas).memberUids).toEqual(['t1'])
  })

  it('lists who eats from each slot', () => {
    const h: Household = { id: 'h', ...newHousehold(thomas) }
    const joined = { ...h, ...joinChanges(h, partner) }
    const [tLunch, pLunch, dinner] = joined.slots
    expect(slotEaters(joined, tLunch).map((m) => m.uid)).toEqual(['t1'])
    expect(slotEaters(joined, pLunch).map((m) => m.uid)).toEqual(['p1'])
    expect(slotEaters(joined, dinner).map((m) => m.uid)).toEqual(['t1', 'p1'])
  })
})
