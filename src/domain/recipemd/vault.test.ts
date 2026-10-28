// Runs the parser over the local vault copy (recipes_vault_copy/, git-ignored) when it exists.
// Skipped on machines without it.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { looksLikeRecipe, parseRecipeMd } from './parse'

const VAULT = join(__dirname, '../../../recipes_vault_copy')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return []
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return markdownFiles(full)
    return name.endsWith('.md') ? [full] : []
  })
}

describe.skipIf(!existsSync(VAULT))('real vault copy', () => {
  const files = existsSync(VAULT) ? markdownFiles(VAULT) : []
  const recipes = files
    .map((f) => ({ path: relative(VAULT, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
    .filter((f) => !f.path.startsWith('Templates/') && looksLikeRecipe(f.text))

  it('finds the recipes and skips plans, lists and indexes', () => {
    const paths = recipes.map((r) => r.path)
    expect(paths.length).toBeGreaterThan(10)
    expect(paths).not.toContain('Meal Plan.md')
    expect(paths).not.toContain('Shopping List.md')
    expect(paths).not.toContain('Ingredients.md')
    expect(paths).not.toContain('Drinks/Drinks.md')
  })

  it.each(recipes.map((r) => [r.path, r.text]))('parses %s', (path, text) => {
    const { recipe } = parseRecipeMd(text, { path })
    expect(recipe.title.length).toBeGreaterThan(0)
    expect(recipe.ingredientGroups.length).toBeGreaterThan(0)
    for (const line of recipe.ingredientGroups.flatMap((g) => g.ingredients)) {
      expect(line.name).not.toMatch(/^\*|\*$/)
      expect(line.name).not.toMatch(/\u00a0/)
    }
  })
})
