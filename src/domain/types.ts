// Core domain model. Pure data: no Firebase or React types in here.
// Dates are local calendar dates as ISO strings ("2026-11-02") — see dates.ts.

export type IsoDate = string

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type Store = 'Costco' | 'Grocery' | 'Either'

export interface Slot {
  id: string
  name: string
  /** Shared slots (dinner) get one entry per member; personal slots belong to one member. */
  shared: boolean
  /** For personal slots: the member this slot belongs to. */
  ownerUid?: string
}

export interface Member {
  uid: string
  name: string
  email: string
  macroTargets: Macros
  /** Default portion in grams, keyed by slot id. */
  defaultPortionG: Record<string, number>
}

export interface ShoppingSchedule {
  store: Exclude<Store, 'Either'>
  everyDays: number
  /** Any date on which this trip happens; other trips are anchor ± n × everyDays. */
  anchorDate: IsoDate
}

export interface Household {
  id: string
  name: string
  memberUids: string[]
  /** Emails allowed to join this household (lower-case). */
  invitedEmails: string[]
  members: Member[]
  slots: Slot[]
  schedule: ShoppingSchedule[]
}

export interface IngredientLine {
  /** Raw amount text as written, e.g. "1 1/2 cups". Empty when the recipe gives no amount. */
  amountText: string
  /** Parsed numeric amount, when parseable. */
  amount?: number
  unit?: string
  name: string
  /** Link to the ingredient catalog, once matched. */
  ingredientId?: string
}

export interface IngredientGroup {
  /** Group heading; empty string for the top-level, ungrouped list. */
  title: string
  ingredients: IngredientLine[]
}

export interface Recipe {
  id: string
  title: string
  description: string
  tags: string[]
  /** Cooked weight of the whole recipe at 1× scale. */
  expectedYieldG?: number
  /** The RecipeMD yields line as written, kept for round-tripping. */
  yieldsText: string
  ingredientGroups: IngredientGroup[]
  instructions: string
  /** Macros for the whole recipe at 1× scale. */
  macrosTotal?: Macros
  fridgeDays: number
  source?: string
}

export interface CatalogIngredient {
  id: string
  name: string
  aliases: string[]
  store: Store
  aisle: string
  /** Days the item keeps after purchase; undefined = shelf stable. */
  shelfLifeDays?: number
  pantryStaple: boolean
  /** Grams per one of the given unit, e.g. { cup: 120, each: 50 }. */
  gramsPerUnit: Record<string, number>
  /** Pack size in grams (for rounding up Costco purchases). */
  packSizeG?: number
}

export type BatchStatus = 'planned' | 'cooked'

export interface Batch {
  id: string
  recipeId: string
  cookDate: IsoDate
  scale: number
  /** Measured after cooking; overrides the estimate when set. */
  actualWeightG?: number
  status: BatchStatus
  frozenG: number
  notes: string
}

export interface MealEntry {
  id: string
  date: IsoDate
  slotId: string
  personUid: string
  batchId: string
  grams: number
}

export interface TripItem {
  key: string
  name: string
  quantityText: string
  aisle: string
  checked: boolean
  manual: boolean
}

export interface Trip {
  id: string
  date: IsoDate
  store: Exclude<Store, 'Either'>
  items: TripItem[]
}
