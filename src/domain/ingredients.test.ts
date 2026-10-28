import { describe, expect, it } from 'vitest'
import { catalogIndex, guessAisle, guessStaple, ingredientKey, isFree } from './ingredients'
import type { CatalogIngredient } from './types'

describe('ingredientKey', () => {
  it.each([
    ['Chicken breasts', 'chicken breast'],
    ['diced chicken breast', 'chicken breast'],
    ['chicken breast', 'chicken breast'],
    ['garlic, pressed or minced', 'garlic'],
    ['garlic cloves minced', 'garlic clove'],
    ['Kosher salt', 'kosher salt'],
    ['freshly-cracked black pepper', 'black pepper'],
    ['salt & pepper to taste', 'salt & pepper'],
    ['honey (reduce)', 'honey'],
    ['large cucumbers', 'cucumber'],
    ['tomatoes', 'tomato'],
    ['frozen berries', 'frozen berry'],
    ['medium banana, ripe', 'banana'],
    ['olive oil, divided', 'olive oil'],
    ['Pepperoni slices', 'pepperoni slice'],
    ['70% chocolate', '70% chocolate'],
  ])('%s → %s', (name, key) => {
    expect(ingredientKey(name)).toBe(key)
  })
})

describe('catalogIndex', () => {
  it('finds items by name or alias, however they are written', () => {
    const item: CatalogIngredient = {
      id: 'c1',
      name: 'Chicken breast',
      aliases: ['boneless skinless chicken breasts'],
      store: 'Costco',
      aisle: 'Meat & fish',
      pantryStaple: false,
      gramsPerUnit: {},
    }
    const index = catalogIndex([item])
    expect(index.get(ingredientKey('diced chicken breast'))).toBe(item)
    expect(index.get(ingredientKey('Boneless skinless chicken breast'))).toBe(item)
    expect(index.get(ingredientKey('chicken thigh'))).toBeUndefined()
  })
})

describe('guesses', () => {
  it('guesses aisles', () => {
    expect(guessAisle('chicken breast')).toBe('Meat & fish')
    expect(guessAisle('shredded sharp cheddar cheese')).toBe('Dairy & eggs')
    expect(guessAisle('broccoli')).toBe('Produce')
    expect(guessAisle('udon noodle')).toBe('Pantry')
    expect(guessAisle('garlic powder')).toBe('Spices')
    expect(guessAisle('sweet chili sauce')).toBe('Sauces & oils')
    expect(guessAisle('frozen mixed veggy')).toBe('Frozen')
    expect(guessAisle('chicken or vegetable stock')).toBe('Sauces & oils')
    expect(guessAisle('cream of chicken soup')).toBe('Sauces & oils')
    expect(guessAisle('mystery thing')).toBe('Other')
  })

  it('guesses pantry staples without catching things you buy', () => {
    expect(guessStaple('kosher salt')).toBe(true)
    expect(guessStaple('black pepper')).toBe(true)
    expect(guessStaple('garlic powder')).toBe(true)
    expect(guessStaple('olive oil')).toBe(true)
    expect(guessStaple('green bell pepper')).toBe(false)
    expect(guessStaple('chicken breast')).toBe(false)
    expect(guessStaple('salted butter')).toBe(false)
  })

  it('never lists water or ice', () => {
    expect(isFree('water')).toBe(true)
    expect(isFree('ice')).toBe(true)
    expect(isFree('rice')).toBe(false)
  })
})
