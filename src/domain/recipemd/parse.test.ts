import { describe, expect, it } from 'vitest'
import { looksLikeRecipe, parseIngredientLine, parseIngredientSection, parseRecipeMd, yieldGrams } from './parse'
import { toRecipeMd, yieldsLine } from './serialize'

const NBSP = ' '

// Shaped like the real vault: frontmatter, no title heading, tags line, bold yields with a weight.
const BURGERS = `---
sticker: emoji//1f354
color: ""
---
Kitchen sink burgers

*beef, bbq*

**12 servings, 3 Ibs**

---

- *3 Ib* ground beef
- *3* eggs
- *3/2 tsp* salt
- *1* yellow onion

---

1. Dice the onion finely
2. Cook on bbq or a pan
7. To store:
\t1. 1-2 days: leave in fridge
`

// Hashtags, plain-text yields right above the separator, no frontmatter.
const LASAGNA_SOUP = `Warm and cozy
#protein
6 Servings
---
- *1/2 tbsp* olive oil
- *23.5 oz* jar marinara sauce
- *1 cup* cottage cheese

---
1. Heat olive oil
`

// Ingredient groups as indented plain lines, a unit outside the emphasis.
const SALMON = `
#protein

---
\tSalmon
- *1* skinless salmon filet
- *1/3 cup* soy sauce
\tCucumber Salad
- *1/4* cup soy sauce
- *2 tbsp* rice vinegar
\tToppings (optional)
- Green onion

---
1. Combine salmon sauce ingredients
`

describe('parseRecipeMd', () => {
  it('reads a recipe with frontmatter, tags, yields and a folder category', () => {
    const { recipe, warnings } = parseRecipeMd(BURGERS, { path: 'Meals/Dinner/Burgers.md' })
    expect(recipe.title).toBe('Burgers')
    expect(recipe.description).toBe('Kitchen sink burgers')
    expect(recipe.tags).toEqual(['beef', 'bbq', 'Dinner'])
    expect(recipe.yieldsText).toBe('12 servings, 3 Ibs')
    expect(recipe.expectedYieldG).toBe(1361)
    expect(recipe.sourcePath).toBe('Meals/Dinner/Burgers.md')
    expect(recipe.ingredientGroups).toHaveLength(1)
    expect(recipe.ingredientGroups[0].ingredients.map((i) => i.name)).toEqual([
      'ground beef',
      'eggs',
      'salt',
      'yellow onion',
    ])
    expect(recipe.ingredientGroups[0].ingredients[0]).toMatchObject({ amount: 3, unit: 'lb', grams: 1360.8 })
    expect(recipe.instructions).toContain('1. Dice the onion finely')
    expect(recipe.instructions).toContain('\t1. 1-2 days: leave in fridge')
    expect(recipe.source).toBe(BURGERS)
    expect(warnings).toEqual([])
  })

  it('reads hashtag tags and a plain "6 Servings" yields line', () => {
    const { recipe } = parseRecipeMd(LASAGNA_SOUP, { path: 'Meals/Dinner/Lasagna Soup.md' })
    expect(recipe.title).toBe('Lasagna Soup')
    expect(recipe.description).toBe('Warm and cozy')
    expect(recipe.tags).toEqual(['protein', 'Dinner'])
    expect(recipe.yieldsText).toBe('6 Servings')
    expect(recipe.expectedYieldG).toBeUndefined()
    expect(recipe.ingredientGroups[0].ingredients[1]).toMatchObject({
      amountText: '23.5 oz',
      unit: 'oz',
      name: 'jar marinara sauce',
    })
  })

  it('reads ingredient groups written as plain lines', () => {
    const { recipe } = parseRecipeMd(SALMON, { path: 'Honey Garlic Salmon Bowls.md' })
    expect(recipe.ingredientGroups.map((g) => g.title)).toEqual(['Salmon', 'Cucumber Salad', 'Toppings (optional)'])
    expect(recipe.ingredientGroups[1].ingredients[0]).toMatchObject({
      amountText: '1/4 cup',
      amount: 0.25,
      unit: 'cup',
      name: 'soy sauce',
    })
    expect(recipe.ingredientGroups[2].ingredients[0]).toEqual({ amountText: '', name: 'Green onion' })
  })

  it('prefers a "# Title" heading over the file name', () => {
    expect(parseRecipeMd('# Real Title\n\n---\n\n- *1* egg\n', { path: 'x.md' }).recipe.title).toBe('Real Title')
  })

  it('does not mistake a leading "---" separator for frontmatter', () => {
    const { recipe } = parseRecipeMd('---\n- *3* bananas\n- *2* eggs\n\n---\n1. Mash\n', { path: 'Banana Bread.md' })
    expect(recipe.ingredientGroups[0].ingredients.map((i) => i.name)).toEqual(['bananas', 'eggs'])
    expect(recipe.instructions).toBe('1. Mash')
  })

  it('keeps a description that merely starts with a number', () => {
    const { recipe } = parseRecipeMd('2 ingredient pancakes\n\n---\n- *1* banana\n', { path: 'p.md' })
    expect(recipe.description).toBe('2 ingredient pancakes')
    expect(recipe.yieldsText).toBe('')
  })

  it('warns about leftover template text and drops placeholder tags', () => {
    const { recipe, warnings } = parseRecipeMd('Yum\n\n*protein, tag2, tag3*\n\n---\n- *1* egg\n', { path: 'a.md' })
    expect(recipe.tags).toEqual(['protein'])
    expect(warnings.some((w) => w.includes('template'))).toBe(true)
  })

  it('warns when there is nothing to import', () => {
    expect(parseRecipeMd('Just some notes', { path: 'Notes.md' }).warnings).toContain(
      'No "---" separator found, so no ingredients could be read.',
    )
  })
})

describe('parseIngredientLine', () => {
  it.each([
    [`*1${NBSP}cup*${NBSP} salted butter`, { amountText: '1 cup', amount: 1, unit: 'cup', name: 'salted butter' }],
    ['*1 ½ cup* warmed milk', { amountText: '1 1/2 cup', amount: 1.5, unit: 'cup', name: 'warmed milk' }],
    ['*1-2 tbsp* Sriracha', { amountText: '1-2 tbsp', amount: 1, amountMax: 2, unit: 'tbsp', name: 'Sriracha' }],
    ['*2* *racks* back ribs', { amountText: '2 racks', amount: 2, unit: 'rack', name: 'back ribs' }],
    [
      '*60ml* or *4 tbsp* Sweet Chili Sauce',
      { amountText: '60ml or 4 tbsp', amount: 60, unit: 'ml', name: 'Sweet Chili Sauce' },
    ],
    ['1 large garlic clove', { amountText: '1', amount: 1, name: 'large garlic clove' }],
    ['*8 tbsp* butter (115g)', { amountText: '8 tbsp', amount: 8, unit: 'tbsp', grams: 115, name: 'butter' }],
    [
      '*3 cups (4 ounces)* shredded sharp cheddar cheese*',
      { amountText: '3 cups (4 ounces)', amount: 3, unit: 'cup', grams: 113.4, name: 'shredded sharp cheddar cheese' },
    ],
    ['*600 g* diced chicken breast', { amountText: '600 g', amount: 600, unit: 'g', grams: 600, name: 'diced chicken breast' }],
    ['Kosher salt', { amountText: '', name: 'Kosher salt' }],
  ])('parses %s', (raw, expected) => {
    expect(parseIngredientLine(raw)).toEqual({ line: expected })
  })

  it('keeps unreadable amounts as text and warns', () => {
    const { line, warning } = parseIngredientLine('*Costco pack* chicken breasts')
    expect(line).toEqual({ amountText: 'Costco pack', name: 'chicken breasts' })
    expect(warning).toContain('Costco pack')
  })
})

describe('looksLikeRecipe', () => {
  it('accepts recipes and rejects notes, plans and empty frontmatter-only files', () => {
    expect(looksLikeRecipe(BURGERS)).toBe(true)
    expect(looksLikeRecipe(LASAGNA_SOUP)).toBe(true)
    expect(looksLikeRecipe('---\nsticker: emoji//1f379\n---\n')).toBe(false)
    expect(looksLikeRecipe('# Week of October 4th\n## Sunday\n- [[Bowls]]')).toBe(false)
    expect(looksLikeRecipe('- [ ] broccoli 8 heads\n- [ ] butter')).toBe(false)
  })
})

describe('yieldGrams', () => {
  it('finds the weight among the yields', () => {
    expect(yieldGrams('18 Servings, 3 kg')).toBe(3000)
    expect(yieldGrams('5 servings')).toBeUndefined()
  })
})

describe('toRecipeMd', () => {
  it('writes strict RecipeMD that reads back the same', () => {
    for (const [md, path] of [
      [BURGERS, 'Meals/Dinner/Burgers.md'],
      [LASAGNA_SOUP, 'Meals/Dinner/Lasagna Soup.md'],
      [SALMON, 'Honey Garlic Salmon Bowls.md'],
    ]) {
      const { recipe } = parseRecipeMd(md, { path })
      const written = toRecipeMd(recipe)
      expect(written.startsWith(`# ${recipe.title}\n`)).toBe(true)
      const { recipe: again } = parseRecipeMd(written)
      expect(again.title).toBe(recipe.title)
      expect(again.description).toBe(recipe.description)
      expect(again.tags).toEqual(recipe.tags)
      expect(again.expectedYieldG).toBe(recipe.expectedYieldG)
      expect(again.ingredientGroups).toEqual(recipe.ingredientGroups)
      expect(again.instructions).toBe(recipe.instructions)
    }
  })

  it('keeps gram hints and replaces the yield weight with the current one', () => {
    const { recipe } = parseRecipeMd('---\n- *8 tbsp* butter (115g)\n', { path: 'b.md' })
    expect(toRecipeMd(recipe)).toContain('- *8 tbsp* butter (115 g)')
    expect(yieldsLine({ yieldsText: '18 Servings, 3 kg', expectedYieldG: 3200 })).toBe('18 Servings, 3200 g')
    expect(yieldsLine({ yieldsText: '', expectedYieldG: 2400 })).toBe('2400 g')
  })
})

describe('parseIngredientSection', () => {
  it('accepts "## Group" headings as written by the app editor', () => {
    const { groups } = parseIngredientSection('- *1* egg\n\n## Sauce\n- *2 tbsp* honey')
    expect(groups.map((g) => [g.title, g.ingredients.length])).toEqual([
      ['', 1],
      ['Sauce', 1],
    ])
  })
})
