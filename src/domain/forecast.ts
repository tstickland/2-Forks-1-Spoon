// Batch "runway": how long a batch lasts given what's planned from it.

import { batchWeight, suggestedScale } from './batch'
import { addDays, daysBetween, formatShort } from './dates'
import type { Batch, IsoDate, MealEntry, Recipe } from './types'

export interface RunwayDay {
  date: IsoDate
  plannedG: number
  /** Grams left after this day's meals (negative = not enough). Undefined if the weight is unknown. */
  remainingG?: number
}

export interface BatchForecast {
  batchId: string
  /** Undefined when neither a measured weight nor the recipe's expected yield is known. */
  weightG?: number
  estimated: boolean
  plannedG: number
  /** Weight minus everything planned; negative when the plan needs more than there is. */
  remainingG?: number
  days: RunwayDay[]
  /** The first day the batch can't cover, and how many grams that day is missing. */
  shortOn?: { date: IsoDate; missingG: number }
  /** Last day it's safe to eat from the fridge. */
  fridgeUntil: IsoDate
  /** Planned meals after the fridge-life cutoff: these portions need to come from the freezer. */
  pastFridgeLife: { date: IsoDate; grams: number }[]
  /** Grams recorded as put in the freezer. */
  frozenG: number
  /** Grams that still need freezing (by `fridgeUntil`) to cover the meals planned after it. */
  freezeMoreG: number
  /** Frozen grams not planned for any meal yet: available to plan. */
  freezerLeftG: number
  /** Planned meals dated before the batch is cooked. */
  beforeCooked: { date: IsoDate; grams: number }[]
  /** Scale (0.5 steps) whose estimate would cover everything planned; only while the batch isn't cooked. */
  suggestedScale?: number
}

function sumByDate(entries: MealEntry[]): Map<IsoDate, number> {
  const byDate = new Map<IsoDate, number>()
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.grams)
  return byDate
}

export function forecastBatch(batch: Batch, recipe: Recipe | undefined, entries: MealEntry[]): BatchForecast {
  const mine = entries.filter((e) => e.batchId === batch.id)
  const weight = batchWeight(batch, recipe)
  const fridgeDays = recipe?.fridgeDays ?? 4
  const fridgeUntil = addDays(batch.cookDate, fridgeDays)

  const byDate = sumByDate(mine)
  const days: RunwayDay[] = []
  let planned = 0
  let shortOn: BatchForecast['shortOn']
  for (const date of [...byDate.keys()].sort()) {
    const plannedG = byDate.get(date)!
    planned += plannedG
    const remainingG = weight ? weight.grams - planned : undefined
    days.push({ date, plannedG, remainingG })
    if (!shortOn && remainingG !== undefined && remainingG < 0) {
      shortOn = { date, missingG: Math.min(plannedG, -remainingG) }
    }
  }

  const remainingG = weight ? weight.grams - planned : undefined
  const pastFridgeLife = days
    .filter((d) => daysBetween(batch.cookDate, d.date) > fridgeDays)
    .map((d) => ({ date: d.date, grams: d.plannedG }))
  const neededFromFreezer = pastFridgeLife.reduce((sum, d) => sum + d.grams, 0)
  const frozenG = batch.frozenG ?? 0
  // Unplanned frozen food, but never more than is actually left of the batch.
  const freezerLeft = Math.max(0, frozenG - neededFromFreezer)

  const forecast: BatchForecast = {
    batchId: batch.id,
    weightG: weight?.grams,
    estimated: weight?.estimated ?? true,
    plannedG: planned,
    remainingG,
    days,
    shortOn,
    fridgeUntil,
    pastFridgeLife,
    frozenG,
    freezeMoreG: Math.max(0, neededFromFreezer - frozenG),
    freezerLeftG: remainingG === undefined ? freezerLeft : Math.min(freezerLeft, Math.max(0, remainingG)),
    beforeCooked: days.filter((d) => d.date < batch.cookDate).map((d) => ({ date: d.date, grams: d.plannedG })),
  }

  // Only worth suggesting while the batch is still just planned and the plan needs more than it makes.
  if (batch.status === 'planned' && batch.actualWeightG === undefined && recipe?.expectedYieldG && (forecast.remainingG ?? 0) < 0) {
    forecast.suggestedScale = suggestedScale(planned, recipe.expectedYieldG)
  }
  return forecast
}

function dayCount(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

/** Plain-language list of what needs attention; empty when the batch is fine. */
export function forecastProblems(f: BatchForecast): string[] {
  const problems: string[] = []
  if (f.weightG === undefined) problems.push('No cooked weight yet, so how long it lasts is unknown.')
  if (f.shortOn) problems.push(`Runs out ${formatShort(f.shortOn.date)}: short ${Math.round(f.shortOn.missingG)} g that day.`)
  if (f.freezeMoreG > 0) {
    problems.push(
      `Freeze ${Math.round(f.freezeMoreG)} g by ${formatShort(f.fridgeUntil)} (${dayCount(f.pastFridgeLife.length)} planned after then).`,
    )
  }
  if (f.beforeCooked.length) problems.push(`${dayCount(f.beforeCooked.length)} planned before it's cooked.`)
  return problems
}
