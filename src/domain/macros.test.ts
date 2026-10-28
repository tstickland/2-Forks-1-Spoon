import { describe, expect, it } from 'vitest'
import { formatMacros, macrosPer100g, scaleMacros } from './macros'

const total = { kcal: 3000, protein: 240, carbs: 300, fat: 90 }

describe('macros', () => {
  it('scales', () => {
    expect(scaleMacros(total, 0.5)).toEqual({ kcal: 1500, protein: 120, carbs: 150, fat: 45 })
  })

  it('gives macros per 100 g of cooked food', () => {
    expect(macrosPer100g(total, 3000)).toEqual({ kcal: 100, protein: 8, carbs: 10, fat: 3 })
    // A batch that cooked down lighter is denser per gram.
    expect(macrosPer100g(total, 2500)!.kcal).toBe(120)
    expect(macrosPer100g(total, 0)).toBeUndefined()
  })

  it('formats', () => {
    expect(formatMacros({ kcal: 519.6, protein: 42.2, carbs: 50, fat: 15.4 })).toBe('520 kcal · 42 P · 50 C · 15 F')
  })
})
