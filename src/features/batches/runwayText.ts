// Text and styling helpers shared by the runway display, plan grid and assign sheet.

import { formatGrams, formatScale } from '../../domain/batch'
import { formatShort } from '../../domain/dates'
import type { BatchForecast } from '../../domain/forecast'
import type { Batch } from '../../domain/types'

// A few distinct tints so the same batch reads as one block across the plan grid. No reds or
// oranges: those mean "problem" (short, past fridge life).
const TINTS = [
  'bg-emerald-50 ring-emerald-200',
  'bg-sky-50 ring-sky-200',
  'bg-amber-50 ring-amber-200',
  'bg-violet-50 ring-violet-200',
  'bg-indigo-50 ring-indigo-200',
  'bg-lime-50 ring-lime-200',
  'bg-cyan-50 ring-cyan-200',
  'bg-teal-50 ring-teal-200',
]

export function batchTint(batchId: string): string {
  let h = 0
  for (const c of batchId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

/** "Sun 1 Nov · 1.5× · ~3600 g" (~ while the weight is an estimate). */
export function batchSubtitle(batch: Batch, forecast: BatchForecast): string {
  const weight = forecast.weightG === undefined ? 'weight unknown' : `${forecast.estimated ? '~' : ''}${formatGrams(forecast.weightG)}`
  return `Cook ${formatShort(batch.cookDate)} · ${formatScale(batch.scale)} · ${weight}`
}

export function runwaySummary(forecast: BatchForecast): string {
  const { weightG, plannedG, remainingG, frozenG, freezerLeftG } = forecast
  const freezer = frozenG > 0 ? ` · ❄ ${formatGrams(frozenG)} frozen${freezerLeftG > 0 ? ` (${formatGrams(freezerLeftG)} unplanned)` : ''}` : ''
  if (weightG === undefined) return `${formatGrams(plannedG)} planned${freezer}`
  if (remainingG! < 0) return `${formatGrams(plannedG)} planned · ${formatGrams(-remainingG!)} short${freezer}`
  return `${formatGrams(plannedG)} planned · ${formatGrams(remainingG!)} spare${freezer}`
}
