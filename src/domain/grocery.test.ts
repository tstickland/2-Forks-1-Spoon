import { describe, expect, it } from 'vitest'
import {
  addLine,
  buildGroceryPlan,
  chooseTrip,
  emptyTotals,
  formatTotals,
  lastPlannedDate,
  tripId,
  upcomingTrips,
  type Trip,
} from './grocery'
import type { Batch, CatalogIngredient, Recipe, ShoppingSchedule } from './types'

// Costco every other Saturday from 31 Oct; grocery store on the Saturdays in between.
const schedule: ShoppingSchedule[] = [
  { store: 'Costco', everyDays: 14, anchorDate: '2026-10-31' },
  { store: 'Grocery', everyDays: 14, anchorDate: '2026-11-07' },
]
const TODAY = '2026-10-28' // Wednesday

const trips = upcomingTrips(schedule, TODAY, '2026-11-30')

function catalogItem(over: Partial<CatalogIngredient> & { id: string; name: string }): CatalogIngredient {
  return { aliases: [], store: 'Either', aisle: '', pantryStaple: false, gramsPerUnit: {}, ...over }
}

describe('upcomingTrips', () => {
  it('lists alternating trips in date order', () => {
    expect(trips.map((t) => t.id)).toEqual([
      'Costco_2026-10-31',
      'Grocery_2026-11-07',
      'Costco_2026-11-14',
      'Grocery_2026-11-21',
      'Costco_2026-11-28',
    ])
    expect(tripId('Costco', '2026-10-31')).toBe('Costco_2026-10-31')
  })
})

describe('chooseTrip', () => {
  const byId = (id: string) => trips.find((t) => t.id === id) as Trip

  it('uses the last trip at the item’s store on or before the cook date', () => {
    expect(chooseTrip(trips, 'Costco', '2026-11-22')).toEqual({ trip: byId('Costco_2026-11-14') })
    expect(chooseTrip(trips, 'Costco', '2026-11-14')).toEqual({ trip: byId('Costco_2026-11-14') }) // shop then cook
    expect(chooseTrip(trips, 'Either', '2026-11-22')).toEqual({ trip: byId('Grocery_2026-11-21') })
  })

  it('buys perishables nearer the cook date at any store', () => {
    // Costco trip on the 14th is 8 days before; fresh herbs keep 5 → the grocery run on the 21st.
    const c = chooseTrip(trips, 'Costco', '2026-11-22', 5)
    expect(c.trip?.id).toBe('Grocery_2026-11-21')
    expect(c.note).toContain('fresh')
  })

  it('warns when nothing is fresh enough', () => {
    const c = chooseTrip(trips, 'Costco', '2026-11-13', 2) // nearest trip is the 7th
    expect(c.trip?.id).toBe('Costco_2026-10-31')
    expect(c.note).toContain('Might not keep')
  })

  it('falls back to another store when its own store has no trip in time', () => {
    const c = chooseTrip(trips.filter((t) => t.store === 'Grocery'), 'Costco', '2026-11-10')
    expect(c.trip?.id).toBe('Grocery_2026-11-07')
    expect(c.note).toBe('No Costco trip before Tue 10 Nov')
  })

  it('reports items needed before any trip', () => {
    expect(chooseTrip(trips, 'Either', '2026-10-29')).toEqual({ note: 'Needed by Thu 29 Oct, before any planned trip' })
  })
})

describe('totals', () => {
  it('adds weights, volumes, counts and unreadable amounts separately', () => {
    const t = emptyTotals()
    addLine(t, { amountText: '600 g', amount: 600, unit: 'g', grams: 600, name: 'beef' }, 1.5)
    addLine(t, { amountText: '2 lbs', amount: 2, unit: 'lb', grams: 907.2, name: 'beef' }, 1)
    addLine(t, { amountText: '1/2 cup', amount: 0.5, unit: 'cup', name: 'beef' }, 1)
    addLine(t, { amountText: '1 tbsp', amount: 1, unit: 'tbsp', name: 'beef' }, 2)
    addLine(t, { amountText: '2 cans', amount: 2, unit: 'can', name: 'beef' }, 1)
    addLine(t, { amountText: '3', amount: 3, name: 'beef' }, 1)
    addLine(t, { amountText: 'Costco pack', name: 'beef' }, 2)
    // 1/2 cup + 2 tbsp = 5/8 cup
    expect(formatTotals(t)).toBe('1.9 kg + 5/8 cup + 2 cans + 3 + Costco pack × 2')
  })

  it('picks up count units written in the name', () => {
    const t = emptyTotals()
    addLine(t, { amountText: '6 cloves', amount: 6, unit: 'clove', name: 'garlic, pressed or minced' }, 1)
    addLine(t, { amountText: '12', amount: 12, name: 'garlic cloves minced' }, 1.5)
    addLine(t, { amountText: '1', amount: 1, name: 'large garlic clove' }, 1)
    expect(formatTotals(t)).toBe('25 cloves')
  })

  it('uses the top of a range and says "as needed" for amount-less lines', () => {
    const t = emptyTotals()
    addLine(t, { amountText: '1-2 tbsp', amount: 1, amountMax: 2, unit: 'tbsp', name: 'sriracha' }, 1)
    expect(formatTotals(t)).toBe('2 tbsp')
    const salt = emptyTotals()
    addLine(salt, { amountText: '', name: 'salt' }, 1)
    expect(formatTotals(salt)).toBe('as needed')
  })

  it('converts with catalog conversions and rounds up to packs', () => {
    const flour = catalogItem({ id: 'f', name: 'Flour', gramsPerUnit: { cup: 120 } })
    const t = emptyTotals()
    addLine(t, { amountText: '2 cups', amount: 2, unit: 'cup', name: 'flour' }, 1, flour)
    addLine(t, { amountText: '8 tbsp', amount: 8, unit: 'tbsp', name: 'flour' }, 1, flour) // 1/2 cup via density
    expect(formatTotals(t, flour)).toBe('300 g')

    const eggs = catalogItem({ id: 'e', name: 'Eggs', gramsPerUnit: { each: 50 } })
    const e = emptyTotals()
    addLine(e, { amountText: '3', amount: 3, name: 'eggs' }, 2, eggs)
    expect(formatTotals(e, eggs)).toBe('300 g')

    const chicken = catalogItem({ id: 'c', name: 'Chicken breast', packSizeG: 2700 })
    const c = emptyTotals()
    addLine(c, { amountText: '4.5 lbs', amount: 4.5, unit: 'lb', grams: 2041.2, name: 'chicken' }, 1.5, chicken)
    expect(formatTotals(c, chicken)).toBe('3.1 kg (2 packs)')
  })
})

describe('buildGroceryPlan', () => {
  const bowls: Recipe = {
    id: 'r1',
    title: 'Cheesy Broccoli Bowls',
    description: '',
    tags: [],
    yieldsText: '',
    fridgeDays: 4,
    instructions: '',
    ingredientGroups: [
      {
        title: '',
        ingredients: [
          { amountText: '4.5 lbs', amount: 4.5, unit: 'lb', grams: 2041.2, name: 'chicken breasts' },
          { amountText: '', name: 'Kosher salt' },
          { amountText: '6 heads', amount: 6, unit: 'head', name: 'broccoli' },
          { amountText: '1 cup', amount: 1, unit: 'cup', name: 'water' },
        ],
      },
    ],
  }
  const wraps: Recipe = {
    ...bowls,
    id: 'r2',
    title: 'Chicken Wraps',
    ingredientGroups: [{ title: '', ingredients: [{ amountText: '600 g', amount: 600, unit: 'g', grams: 600, name: 'diced chicken breast' }] }],
  }
  const recipeById = new Map([bowls, wraps].map((r) => [r.id, r]))
  const batch = (id: string, recipeId: string, cookDate: string, over: Partial<Batch> = {}): Batch => ({
    id, recipeId, cookDate, scale: 1, status: 'planned', frozenG: 0, notes: '', ...over,
  })
  const catalog = [
    catalogItem({ id: 'chicken', name: 'Chicken breast', store: 'Costco', aisle: 'Meat', packSizeG: 2700 }),
    catalogItem({ id: 'broc', name: 'Broccoli', store: 'Grocery', aisle: 'Produce', shelfLifeDays: 5 }),
  ]

  const plan = buildGroceryPlan({
    batches: [
      batch('b1', 'r1', '2026-11-15'), // Sunday after the Costco trip on the 14th
      batch('b2', 'r2', '2026-11-22'), // Sunday after the grocery trip on the 21st
      batch('b0', 'r1', '2026-11-01', { status: 'cooked' }), // already cooked: nothing to buy
      batch('bx', 'r1', '2026-10-20'), // in the past
    ],
    recipeById,
    catalog,
    schedule,
    today: TODAY,
    plannedUntil: '2026-11-27',
  })
  const list = (id: string) => plan.trips.find((t) => t.trip.id === id)!

  it('puts Costco items on the Costco trip before each cook day, merging names across recipes', () => {
    const costco14 = list('Costco_2026-11-14')
    // 2041 g for the bowls + 600 g for the wraps; broccoli is here too (see the freshness test).
    expect(costco14.items.map((i) => [i.name, i.quantity])).toEqual([
      ['Chicken breast', '2.7 kg (1 pack)'],
      ['Broccoli', '6 heads'],
    ])
    // The wraps on the 22nd still need chicken from the Costco run on the 14th.
    expect(costco14.items[0].uses.map((u) => u.recipeTitle)).toEqual(['Cheesy Broccoli Bowls', 'Chicken Wraps'])
  })

  it('buys perishables close to cooking, and skips water', () => {
    // Broccoli is a grocery item; the grocery trip before the 15th is the 7th (8 days) > 5 days shelf life,
    // so it moves to the Costco trip on the 14th.
    expect(list('Grocery_2026-11-07').items).toEqual([])
    const broccoli = list('Costco_2026-11-14').items.find((i) => i.name === 'Broccoli')!
    expect(broccoli.notes).toEqual(["Bought nearer Sun 15 Nov so it's fresh"])
    expect(plan.trips.flatMap((t) => [...t.items, ...t.staples]).some((i) => i.name === 'Water')).toBe(false)
  })

  it('lists pantry staples separately, with guessed aisles for items not set up', () => {
    const costco14 = list('Costco_2026-11-14')
    expect(costco14.staples.map((s) => [s.name, s.quantity, s.aisle, s.aisleGuessed])).toEqual([['Kosher salt', 'as needed', 'Spices', true]])
  })

  it('ignores cooked and past batches', () => {
    expect(list('Costco_2026-10-31').items).toEqual([])
    expect(plan.uncovered).toEqual([])
  })

  it('warns when the plan stops before the next trip to the same store', () => {
    expect(list('Costco_2026-11-14').planGap).toBeUndefined() // next Costco is the 28th, planned until the 27th
    expect(list('Costco_2026-11-28').planGap).toEqual({ plannedUntil: '2026-11-27', nextTrip: '2026-12-12' })
  })

  it('finds the last planned date from batches and meals', () => {
    expect(lastPlannedDate([{ cookDate: '2026-11-15' }], [{ date: '2026-11-20' }])).toBe('2026-11-20')
    expect(lastPlannedDate([], [])).toBeUndefined()
  })
})
