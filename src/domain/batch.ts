import { formatNumber } from './quantity'
import type { Batch, IngredientLine, Recipe } from './types'

export interface BatchWeight {
  grams: number
  /** True while it's an estimate from the recipe; false once the cooked batch has been weighed. */
  estimated: boolean
}

/** The batch's cooked weight: the measured weight if recorded, otherwise recipe yield × scale. */
export function batchWeight(batch: Pick<Batch, 'actualWeightG' | 'scale'>, recipe?: Pick<Recipe, 'expectedYieldG'>): BatchWeight | undefined {
  if (batch.actualWeightG !== undefined) return { grams: batch.actualWeightG, estimated: false }
  if (recipe?.expectedYieldG) return { grams: Math.round(recipe.expectedYieldG * batch.scale), estimated: true }
  return undefined
}

/** The recipe's cooked weight at 1×, implied by a weighed batch. */
export function yieldPerScale(actualWeightG: number, scale: number): number {
  return Math.round(actualWeightG / scale)
}

/** Smallest scale (in 0.5 steps, at least 0.5) whose estimated weight covers the grams needed. */
export function suggestedScale(neededG: number, expectedYieldG: number): number {
  return Math.max(0.5, Math.ceil((neededG / expectedYieldG) * 2) / 2)
}

/** "1.5×" */
export function formatScale(scale: number): string {
  return `${formatNumber(scale)}×`
}

/** "3600 g" or "12.4 kg" for big numbers. */
export function formatGrams(g: number): string {
  return Math.abs(g) >= 10000 ? `${formatNumber(g / 1000)} kg` : `${Math.round(g)} g`
}

const FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
  [1, ''],
]

/** Kitchen-friendly number: whole grams/ml, otherwise the nearest common fraction ("1 1/2"). */
export function formatAmount(value: number, unit?: string): string {
  if (unit === 'g' || unit === 'ml') return String(Math.round(value))
  let whole = Math.floor(value)
  const rest = value - whole
  let [frac, text] = FRACTIONS[0]
  for (const f of FRACTIONS) if (Math.abs(f[0] - rest) < Math.abs(frac - rest)) [frac, text] = f
  if (frac === 1) whole += 1
  if (whole === 0 && !text) return formatNumber(value)
  return [whole || '', text].filter(Boolean).join(' ')
}

/** The amount for one ingredient line at a given scale, ready to display. */
export function scaledAmountText(line: IngredientLine, scale: number): string {
  if (scale === 1 || !line.amountText) return line.amountText
  if (line.amount === undefined) return `${line.amountText} × ${formatNumber(scale)}`
  const unit = line.unit ? ` ${line.unit}` : ''
  const value = formatAmount(line.amount * scale, line.unit)
  const max = line.amountMax !== undefined ? `-${formatAmount(line.amountMax * scale, line.unit)}` : ''
  return `${value}${max}${unit}`
}
