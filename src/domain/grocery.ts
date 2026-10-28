// Shopping lists generated from the plan: which trip buys what, and how much.

import { formatAmount, scaledAmountText } from './batch'
import { addDays, daysBetween, formatShort, recurringDates } from './dates'
import { catalogIndex, guessAisle, guessStaple, ingredientKey, isFree } from './ingredients'
import { formatNumber } from './quantity'
import type { Batch, CatalogIngredient, IngredientLine, IsoDate, Recipe, ShoppingSchedule, Store, TripStore } from './types'

export interface Trip {
  id: string
  store: TripStore
  date: IsoDate
}

export function tripId(store: TripStore, date: IsoDate): string {
  return `${store}_${date}`
}

/** Every scheduled trip in [from, to], by date. */
export function upcomingTrips(schedule: ShoppingSchedule[], from: IsoDate, to: IsoDate): Trip[] {
  return schedule
    .flatMap((s) => recurringDates(s.anchorDate, s.everyDays, from, to).map((date) => ({ id: tripId(s.store, date), store: s.store, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.store.localeCompare(b.store))
}

// ---------------------------------------------------------------------------------------------
// Quantities

const ML_PER: Record<string, number> = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, 'fl oz': 29.5735, ml: 1, l: 1000 }

/** A running total that keeps weights, volumes and counts apart until they can be combined. */
export interface Totals {
  grams: number
  ml: number
  /** Count by unit; "" for bare numbers ("3 eggs"). */
  counts: Record<string, number>
  /** Amounts that couldn't be read, already scaled ("Costco pack × 2"). */
  other: string[]
  /** At least one recipe lists it without an amount ("salt"). */
  asNeeded: boolean
}

export function emptyTotals(): Totals {
  return { grams: 0, ml: 0, counts: {}, other: [], asNeeded: false }
}

/** Grams per ml for an item, from any volume conversion in the catalog ("1 cup flour = 120 g"). */
function density(item: CatalogIngredient | undefined): number | undefined {
  for (const [unit, grams] of Object.entries(item?.gramsPerUnit ?? {})) {
    if (ML_PER[unit]) return grams / ML_PER[unit]
  }
  return undefined
}

const COUNT_WORD = /\b(clove|can|head|slice|rack|jar|bunch|piece|filet|fillet)s?\b/i

/** A count unit written in the name instead of the amount: "12 garlic cloves minced" → clove. */
function countUnitInName(name: string): string | undefined {
  const m = name.match(COUNT_WORD)
  return m ? (m[1].toLowerCase() === 'fillet' ? 'filet' : m[1].toLowerCase()) : undefined
}

/** Add one recipe line, scaled, converting to grams wherever the catalog allows. */
export function addLine(t: Totals, line: IngredientLine, scale: number, item?: CatalogIngredient): void {
  if (line.grams !== undefined) {
    t.grams += line.grams * scale
    return
  }
  // Buy for the top of a range.
  const amount = (line.amountMax ?? line.amount)
  if (amount === undefined) {
    if (line.amountText) t.other.push(scaledAmountText(line, scale))
    else t.asNeeded = true
    return
  }
  const qty = amount * scale
  const unit = line.unit ?? countUnitInName(line.name) ?? ''
  const direct = item?.gramsPerUnit[unit || 'each']
  if (direct) {
    t.grams += qty * direct
  } else if (ML_PER[unit]) {
    const d = density(item)
    if (d) t.grams += qty * ML_PER[unit] * d
    else t.ml += qty * ML_PER[unit]
  } else {
    t.counts[unit] = (t.counts[unit] ?? 0) + qty
  }
}

const PLURALS: Record<string, string> = {
  clove: 'cloves', can: 'cans', jar: 'jars', head: 'heads', slice: 'slices', rack: 'racks', pack: 'packs',
  bunch: 'bunches', piece: 'pieces', filet: 'filets', serving: 'servings', cup: 'cups',
}

function unitLabel(unit: string, n: number): string {
  return n > 1 && PLURALS[unit] ? PLURALS[unit] : unit
}

/** Round up (you can't buy too little), ignoring floating-point dust like 300.0003. */
function roundUp(n: number): number {
  return Math.ceil(n - 1e-6 * Math.max(1, Math.abs(n)))
}

function formatWeight(g: number): string {
  return g >= 1000 ? `${formatNumber(roundUp(g / 100) / 10)} kg` : `${roundUp(g)} g`
}

function formatVolume(ml: number): string {
  if (ml >= ML_PER.cup / 4) {
    const cups = ml / ML_PER.cup
    return `${formatAmount(cups, 'cup')} ${unitLabel('cup', cups)}`
  }
  if (ml >= ML_PER.tbsp) return `${formatAmount(ml / ML_PER.tbsp, 'tbsp')} tbsp`
  return `${formatAmount(ml / ML_PER.tsp, 'tsp')} tsp`
}

/** "1.4 kg (2 packs) + 3 cans", or "as needed". */
export function formatTotals(t: Totals, item?: CatalogIngredient): string {
  const parts: string[] = []
  if (t.grams > 0) {
    const packs = item?.packSizeG ? Math.ceil(t.grams / item.packSizeG) : undefined
    parts.push(`${formatWeight(t.grams)}${packs ? ` (${packs} pack${packs === 1 ? '' : 's'})` : ''}`)
  }
  if (t.ml > 0) parts.push(formatVolume(t.ml))
  for (const [unit, n] of Object.entries(t.counts)) {
    parts.push(unit ? `${formatAmount(n)} ${unitLabel(unit, n)}` : formatAmount(n))
  }
  parts.push(...t.other)
  if (parts.length === 0) return t.asNeeded ? 'as needed' : ''
  return parts.join(' + ')
}

// ---------------------------------------------------------------------------------------------
// Which trip buys what

export interface ItemUse {
  batchId: string
  recipeTitle: string
  cookDate: IsoDate
}

export interface GroceryItem {
  /** Stable id for ticking off: `c:<catalog id>` once set up, `k:<ingredient key>` before. */
  key: string
  /** Normalised ingredient name, for setting the item up in the catalog. */
  ingredientKey: string
  name: string
  catalog?: CatalogIngredient
  aisle: string
  /** The aisle is a guess because the item hasn't been set up yet. */
  aisleGuessed: boolean
  quantity: string
  uses: ItemUse[]
  /** Why it's on this trip rather than the usual one, or a freshness worry. */
  notes: string[]
}

export interface TripList {
  trip: Trip
  items: GroceryItem[]
  /** Pantry staples: check you have them rather than buy. */
  staples: GroceryItem[]
  /** The following trip to the same store. Everything cooked before it should be on this list. */
  nextSameStore?: IsoDate
  /** Set when the plan stops before the next trip to this store, so this list may be missing things. */
  planGap?: { plannedUntil?: IsoDate; nextTrip: IsoDate }
}

export interface GroceryPlan {
  trips: TripList[]
  /** Needed for batches cooked before any scheduled trip. */
  uncovered: GroceryItem[]
}

interface Choice {
  trip?: Trip
  note?: string
}

function latest(trips: Trip[]): Trip | undefined {
  return trips.reduce<Trip | undefined>((best, t) => (!best || t.date > best.date ? t : best), undefined)
}

/**
 * The trip to buy an ingredient on: the last trip at its store on or before the cook date.
 * Perishables that wouldn't keep that long move to a later trip at any store; with no trip at its
 * store in time, the last trip anywhere will do.
 */
export function chooseTrip(trips: Trip[], store: Store, cookDate: IsoDate, shelfLifeDays?: number): Choice {
  const before = trips.filter((t) => t.date <= cookDate)
  const fresh = (t: Trip) => shelfLifeDays === undefined || daysBetween(t.date, cookDate) <= shelfLifeDays
  const usual = latest(before.filter((t) => store === 'Either' || t.store === store))
  if (usual && fresh(usual)) return { trip: usual }

  const anyFresh = latest(before.filter(fresh))
  if (usual) {
    return anyFresh
      ? { trip: anyFresh, note: `Bought nearer ${formatShort(cookDate)} so it's fresh` }
      : { trip: usual, note: `Might not keep until ${formatShort(cookDate)}` }
  }
  const any = latest(before)
  if (any) {
    const notes = [store !== 'Either' && `No ${store} trip before ${formatShort(cookDate)}`, !fresh(any) && `Might not keep until ${formatShort(cookDate)}`]
    return { trip: any, note: notes.filter(Boolean).join('. ') || undefined }
  }
  return { note: `Needed by ${formatShort(cookDate)}, before any planned trip` }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface Accum {
  item: GroceryItem
  totals: Totals
  staple: boolean
}

export interface GroceryInput {
  batches: Batch[]
  recipeById: Map<string, Recipe>
  catalog: CatalogIngredient[]
  schedule: ShoppingSchedule[]
  today: IsoDate
  /** Last date with anything planned (a meal or a batch). */
  plannedUntil?: IsoDate
  /** How far ahead to list trips. */
  horizonDays?: number
}

export function buildGroceryPlan(input: GroceryInput): GroceryPlan {
  const { batches, recipeById, catalog, schedule, today, plannedUntil, horizonDays = 42 } = input
  const trips = upcomingTrips(schedule, today, addDays(today, horizonDays))
  const index = catalogIndex(catalog)
  const buckets = new Map<string, Map<string, Accum>>() // trip id ("" = uncovered) → item key → totals

  const toBuy = batches.filter((b) => b.status === 'planned' && b.cookDate >= today)
  for (const batch of [...toBuy].sort((a, b) => a.cookDate.localeCompare(b.cookDate))) {
    const recipe = recipeById.get(batch.recipeId)
    if (!recipe) continue
    for (const line of recipe.ingredientGroups.flatMap((g) => g.ingredients)) {
      const key = ingredientKey(line.name)
      if (isFree(key)) continue
      const item = index.get(key)
      const choice = chooseTrip(trips, item?.store ?? 'Either', batch.cookDate, item?.shelfLifeDays)
      const bucket = buckets.get(choice.trip?.id ?? '') ?? new Map<string, Accum>()
      buckets.set(choice.trip?.id ?? '', bucket)

      const itemKey = item ? `c:${item.id}` : `k:${key}`
      let acc = bucket.get(itemKey)
      if (!acc) {
        acc = {
          item: {
            key: itemKey,
            ingredientKey: key,
            name: item?.name ?? capitalise(key),
            catalog: item,
            aisle: item?.aisle || guessAisle(key),
            aisleGuessed: !item?.aisle,
            quantity: '',
            uses: [],
            notes: [],
          },
          totals: emptyTotals(),
          staple: item ? item.pantryStaple : guessStaple(key),
        }
        bucket.set(itemKey, acc)
      }
      addLine(acc.totals, line, batch.scale, item)
      if (!acc.item.uses.some((u) => u.batchId === batch.id)) {
        acc.item.uses.push({ batchId: batch.id, recipeTitle: recipe.title, cookDate: batch.cookDate })
      }
      if (choice.note && !acc.item.notes.includes(choice.note)) acc.item.notes.push(choice.note)
    }
  }

  const finish = (accs: Iterable<Accum>) =>
    [...accs]
      .map((a) => ({ ...a, item: { ...a.item, quantity: formatTotals(a.totals, a.item.catalog) } }))
      .sort((a, b) => a.item.aisle.localeCompare(b.item.aisle) || a.item.name.localeCompare(b.item.name))

  const tripLists = trips.map((trip): TripList => {
    const accs = finish(buckets.get(trip.id)?.values() ?? [])
    const every = schedule.find((s) => s.store === trip.store)!.everyDays
    const nextSameStore = addDays(trip.date, every)
    const coveredUntil = addDays(nextSameStore, -1)
    const list: TripList = {
      trip,
      items: accs.filter((a) => !a.staple).map((a) => a.item),
      staples: accs.filter((a) => a.staple).map((a) => a.item),
      nextSameStore,
    }
    if (!plannedUntil || plannedUntil < coveredUntil) list.planGap = { plannedUntil, nextTrip: nextSameStore }
    return list
  })

  return { trips: tripLists, uncovered: finish(buckets.get('')?.values() ?? []).map((a) => a.item) }
}

/** The last date anything is planned: a meal, or a batch's cook date. */
export function lastPlannedDate(batches: Pick<Batch, 'cookDate'>[], entries: { date: IsoDate }[]): IsoDate | undefined {
  let last: IsoDate | undefined
  for (const d of [...batches.map((b) => b.cookDate), ...entries.map((e) => e.date)]) if (!last || d > last) last = d
  return last
}
