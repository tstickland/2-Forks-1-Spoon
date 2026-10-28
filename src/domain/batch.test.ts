import { describe, expect, it } from 'vitest'
import { batchWeight, formatAmount, formatGrams, formatScale, scaledAmountText, suggestedScale, yieldPerScale } from './batch'

describe('batchWeight', () => {
  it('prefers the measured weight, otherwise estimates from the recipe', () => {
    expect(batchWeight({ scale: 1.5, actualWeightG: 3100 }, { expectedYieldG: 2400 })).toEqual({ grams: 3100, estimated: false })
    expect(batchWeight({ scale: 1.5 }, { expectedYieldG: 2400 })).toEqual({ grams: 3600, estimated: true })
    expect(batchWeight({ scale: 1.5 }, {})).toBeUndefined()
    expect(batchWeight({ scale: 1 }, undefined)).toBeUndefined()
  })

  it('works out the recipe yield implied by a weighed batch', () => {
    expect(yieldPerScale(3100, 1.5)).toBe(2067)
  })
})

describe('suggestedScale', () => {
  it('rounds up to the next half', () => {
    expect(suggestedScale(4000, 2400)).toBe(2)
    expect(suggestedScale(2500, 2400)).toBe(1.5)
    expect(suggestedScale(100, 2400)).toBe(0.5)
  })
})

describe('formatting', () => {
  it('formats scale and grams', () => {
    expect(formatScale(1.5)).toBe('1.5×')
    expect(formatGrams(3600.4)).toBe('3600 g')
    expect(formatGrams(12400)).toBe('12.4 kg')
  })

  it('formats amounts as kitchen fractions, grams as whole numbers', () => {
    expect(formatAmount(1.5, 'cup')).toBe('1 1/2')
    expect(formatAmount(0.75, 'tsp')).toBe('3/4')
    expect(formatAmount(0.333, 'cup')).toBe('1/3')
    expect(formatAmount(2.99, 'tbsp')).toBe('3')
    expect(formatAmount(3, undefined)).toBe('3')
    expect(formatAmount(337.5, 'g')).toBe('338')
    expect(formatAmount(0.01, 'tsp')).toBe('0.01')
  })
})

describe('scaledAmountText', () => {
  const line = { amountText: '3/4 cup', amount: 0.75, unit: 'cup', name: 'panko' }

  it('scales parsed amounts and keeps the unit', () => {
    expect(scaledAmountText(line, 2)).toBe('1 1/2 cup')
    expect(scaledAmountText({ amountText: '600 g', amount: 600, unit: 'g', name: 'beef' }, 1.5)).toBe('900 g')
    expect(scaledAmountText({ amountText: '1-2 tbsp', amount: 1, amountMax: 2, unit: 'tbsp', name: 'sriracha' }, 2)).toBe('2-4 tbsp')
    expect(scaledAmountText({ amountText: '3', amount: 3, name: 'eggs' }, 1.5)).toBe('4 1/2')
  })

  it('leaves things alone at 1× and marks unparseable amounts', () => {
    expect(scaledAmountText(line, 1)).toBe('3/4 cup')
    expect(scaledAmountText({ amountText: 'Costco pack', name: 'chicken' }, 2)).toBe('Costco pack × 2')
    expect(scaledAmountText({ amountText: '', name: 'salt' }, 2)).toBe('')
  })
})
