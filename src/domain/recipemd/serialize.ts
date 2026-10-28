// Writes recipes back out as strict RecipeMD, so they can go back into an Obsidian vault.

import { isMassUnit, parseQuantity } from '../quantity'
import type { IngredientGroup, IngredientLine, Recipe } from '../types'

/** The yields line with the weight replaced by the recipe's current expected yield. */
export function yieldsLine(recipe: Pick<Recipe, 'yieldsText' | 'expectedYieldG'>): string {
  const parts = recipe.yieldsText
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !isMassUnit(parseQuantity(p)?.unit))
  if (recipe.expectedYieldG) parts.push(`${recipe.expectedYieldG} g`)
  return parts.join(', ')
}

export function ingredientLineMd(line: IngredientLine): string {
  // Keep a bracketed gram hint when the amount itself isn't a weight, so it survives a round trip.
  const hint = line.grams !== undefined && !isMassUnit(line.unit) ? ` (${line.grams} g)` : ''
  const name = `${line.name}${hint}`
  return line.amountText ? `- *${line.amountText}* ${name}` : `- ${name}`
}

/** The ingredient list as editable text: "## Group" headings followed by "- *amount* name" lines. */
export function ingredientSectionMd(groups: IngredientGroup[]): string {
  return groups
    .map((g) => [g.title ? `## ${g.title}` : '', ...g.ingredients.map(ingredientLineMd)].filter(Boolean).join('\n'))
    .join('\n\n')
}

export function toRecipeMd(recipe: Omit<Recipe, 'id'>): string {
  const header = [`# ${recipe.title}`]
  if (recipe.description) header.push(recipe.description)
  if (recipe.tags.length) header.push(`*${recipe.tags.join(', ')}*`)
  const yields = yieldsLine(recipe)
  if (yields) header.push(`**${yields}**`)

  const sections = [header.join('\n\n'), ingredientSectionMd(recipe.ingredientGroups)]
  if (recipe.instructions) sections.push(recipe.instructions)
  return `${sections.join('\n\n---\n\n')}\n`
}
