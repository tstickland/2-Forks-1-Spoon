import { describe, expect, it } from 'vitest'
import { canonicalUnit, extractMassHint, normalizeText, parseQuantity, toGrams } from './quantity'

describe('normalizeText', () => {
  it('expands unicode fractions and removes non-breaking spaces', () => {
    expect(normalizeText('1 ½ cup')).toBe('1 1/2 cup')
    expect(normalizeText('1½ cup')).toBe('1 1/2 cup')
    expect(normalizeText('⅜ teaspoon')).toBe('3/8 teaspoon')
  })
})

describe('canonicalUnit', () => {
  it('recognises spellings, plurals, trailing dots and the "Ib" typo', () => {
    expect(canonicalUnit('Tablespoons')).toBe('tbsp')
    expect(canonicalUnit('lbs.')).toBe('lb')
    expect(canonicalUnit('Ibs')).toBe('lb')
    expect(canonicalUnit('mL')).toBe('ml')
    expect(canonicalUnit('heads')).toBe('head')
    expect(canonicalUnit('chicken')).toBeUndefined()
  })
})

describe('parseQuantity', () => {
  it.each([
    ['500 g', { value: 500, unit: 'g' }],
    ['60ml', { value: 60, unit: 'ml' }],
    ['1.5 cups', { value: 1.5, unit: 'cup' }],
    ['1/2 tsp', { value: 0.5, unit: 'tsp' }],
    ['3/2 tsp', { value: 1.5, unit: 'tsp' }],
    ['1 ½ cup', { value: 1.5, unit: 'cup' }],
    ['¾ teaspoon', { value: 0.75, unit: 'tsp' }],
    ['1-2 tbsp', { value: 1, max: 2, unit: 'tbsp' }],
    ['1/2 to 1 cup', { value: 0.5, max: 1, unit: 'cup' }],
    ['2 lbs.', { value: 2, unit: 'lb' }],
    ['3 Ib', { value: 3, unit: 'lb' }],
    ['3 cups (4 ounces)', { value: 3, unit: 'cup' }],
    ['2 15 oz cans', { value: 2, unit: '15 oz cans' }],
    ['3', { value: 3 }],
    ['~900 g', { value: 900, unit: 'g' }],
  ])('parses %s', (text, expected) => {
    expect(parseQuantity(text)).toEqual(expected)
  })

  it('returns undefined when there is no number', () => {
    expect(parseQuantity('Costco pack')).toBeUndefined()
    expect(parseQuantity('')).toBeUndefined()
  })
})

describe('toGrams', () => {
  it('converts mass units and uses the top of a range', () => {
    expect(toGrams({ value: 3, unit: 'kg' })).toBe(3000)
    expect(toGrams({ value: 2, unit: 'lb' })).toBeCloseTo(907.18)
    expect(toGrams({ value: 100, max: 150, unit: 'g' })).toBe(150)
  })

  it('does not guess for volumes or counts', () => {
    expect(toGrams({ value: 1, unit: 'cup' })).toBeUndefined()
    expect(toGrams({ value: 3 })).toBeUndefined()
  })
})

describe('extractMassHint', () => {
  it('pulls a bracketed mass out of text', () => {
    expect(extractMassHint('butter (115g)')).toEqual({ grams: 115, text: 'butter' })
    expect(extractMassHint('shredded cheddar cheese (~900g)')).toEqual({ grams: 900, text: 'shredded cheddar cheese' })
    expect(extractMassHint('3 cups (4 ounces)').grams).toBeCloseTo(113.4)
  })

  it('leaves non-mass brackets alone', () => {
    expect(extractMassHint('vodka (Vanilla is best)')).toEqual({ text: 'vodka (Vanilla is best)' })
  })
})
