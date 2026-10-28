// A forgiving RecipeMD (https://recipemd.org) reader that also copes with how Obsidian vaults
// tend to drift from the spec: YAML frontmatter, #hashtag tags, plain-text yields, ingredient
// groups written as plain lines, units outside the *amount*, unicode fractions and so on.

import { canonicalUnit, extractMassHint, isKnownUnit, isMassUnit, normalizeText, parseQuantity, toGrams } from '../quantity'
import type { IngredientGroup, IngredientLine, Recipe } from '../types'

export const DEFAULT_FRIDGE_DAYS = 4

export type ParsedRecipe = Omit<Recipe, 'id'>

export interface ParseResult {
  recipe: ParsedRecipe
  /** Things a person should check after importing. */
  warnings: string[]
}

const SEPARATOR = /^\s*-{3,}\s*$/

// Text from the RecipeMD / Obsidian recipe template that sometimes gets left in by accident.
const TEMPLATE_PHRASES = [
  'A short description of the recipe',
  'ingredient 1',
  'more ingredients as needed',
  'tag1, tag2',
  'The instructions, that is how to prepare',
]

function splitLines(text: string): string[] {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
}

/** Drop Obsidian/YAML frontmatter (---\nkey: value\n---) without mistaking a RecipeMD separator for it. */
function stripFrontmatter(lines: string[]): string[] {
  if (!SEPARATOR.test(lines[0] ?? '')) return lines
  const close = lines.findIndex((l, i) => i > 0 && SEPARATOR.test(l))
  if (close === -1) return lines
  const firstContent = lines.slice(1, close).find((l) => l.trim())
  if (firstContent !== undefined && !/^[A-Za-z_][\w-]*\s*:/.test(firstContent)) return lines
  return lines.slice(close + 1)
}

/** True if the text has the shape of a recipe: a separator followed by at least one list item. */
export function looksLikeRecipe(markdown: string): boolean {
  const lines = stripFrontmatter(splitLines(markdown))
  const sep = lines.findIndex((l) => SEPARATOR.test(l))
  return sep !== -1 && lines.slice(sep + 1).some((l) => /^\s*[-*+]\s+\S/.test(l))
}

function isWholeEmphasis(line: string): boolean {
  return /^\*[^*].*[^*]\*$|^\*[^*]\*$/.test(line) || /^_[^_].*_$/.test(line)
}

function isWholeBold(line: string): boolean {
  return /^\*\*.+\*\*$/.test(line) || /^__.+__$/.test(line)
}

function isHashtagLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((t) => /^#[^\s#]+$/.test(t))
}

/** A plain line like "6 Servings" or "2 servings, 200 g" — every part is a number with a unit. */
function isPlainYields(line: string): boolean {
  return line.split(',').every((part) => isKnownUnit(parseQuantity(part)?.unit))
}

/** Cooked weight in grams from a yields line like "18 Servings, 3 kg". */
export function yieldGrams(yieldsText: string): number | undefined {
  for (const part of yieldsText.split(',')) {
    const q = parseQuantity(part)
    const g = q && toGrams(q)
    if (g) return Math.round(g)
  }
  return undefined
}

interface Header {
  title?: string
  description: string
  tags: string[]
  yieldsText: string
}

function parseHeader(lines: string[]): Header {
  const header: Header = { description: '', tags: [], yieldsText: '' }
  const description: string[] = []
  for (const raw of lines) {
    const line = normalizeText(raw)
    if (!line) {
      if (description.length) description.push('')
      continue
    }
    const heading = line.match(/^#\s+(.+)$/)
    if (heading && !header.title) {
      header.title = heading[1].trim()
    } else if (isHashtagLine(line)) {
      header.tags.push(...line.split(/\s+/).map((t) => t.slice(1)))
    } else if (isWholeBold(line)) {
      header.yieldsText = line.slice(2, -2).trim()
    } else if (isWholeEmphasis(line)) {
      header.tags.push(...line.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean))
    } else if (!header.yieldsText && isPlainYields(line)) {
      header.yieldsText = line
    } else {
      description.push(raw.trim())
    }
  }
  header.description = description.join('\n').trim()
  return header
}

/** Parse one ingredient list item (without the leading "- "). */
export function parseIngredientLine(raw: string): { line: IngredientLine; warning?: string } {
  let rest = normalizeText(raw)
  let amountText = ''

  const emphasis = rest.match(/^\*([^*]+)\*\s*/)
  if (emphasis) {
    amountText = emphasis[1].trim()
    rest = rest.slice(emphasis[0].length)
    // A unit in its own emphasis: "*2* *racks* back ribs"
    const unitEmphasis = rest.match(/^\*([^*\d][^*]*)\*\s*/)
    if (unitEmphasis) {
      amountText += ` ${unitEmphasis[1].trim()}`
      rest = rest.slice(unitEmphasis[0].length)
    }
    // An alternative amount: "*60ml* or *4 tbsp* sweet chili sauce"
    const alternative = rest.match(/^or\s+\*([^*]+)\*\s*/i)
    if (alternative) {
      amountText += ` or ${alternative[1].trim()}`
      rest = rest.slice(alternative[0].length)
    }
  } else {
    // No emphasis, but a leading number: "1 large garlic clove"
    const plain = rest.match(/^(~?\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?)\s+/)
    if (plain) {
      amountText = plain[1]
      rest = rest.slice(plain[0].length)
    }
  }

  const quantity = amountText ? parseQuantity(amountText.split(/\s+or\s+/i)[0]) : undefined

  // A unit written after the amount: "*1/4* cup soy sauce"
  if (quantity && !quantity.unit) {
    const word = rest.match(/^(\S+)\s+/)
    const unit = word && canonicalUnit(word[1])
    if (word && unit) {
      quantity.unit = unit
      amountText += ` ${word[1]}`
      rest = rest.slice(word[0].length)
    }
  }

  const amountHint = extractMassHint(amountText)
  const nameHint = extractMassHint(rest)
  const name = nameHint.text.replace(/^\*+|\*+$/g, '').replace(/,\s*$/, '').trim()

  const line: IngredientLine = { amountText, name }
  if (quantity) {
    line.amount = quantity.value
    if (quantity.max !== undefined) line.amountMax = quantity.max
    if (quantity.unit) line.unit = quantity.unit
  }
  const grams = (quantity && isMassUnit(quantity.unit) ? toGrams(quantity) : undefined) ?? amountHint.grams ?? nameHint.grams
  if (grams !== undefined) line.grams = Math.round(grams * 10) / 10

  const warning =
    amountText && !quantity ? `Couldn't read the amount "${amountText}" for ${name || 'an ingredient'}.` : undefined
  return { line, warning }
}

/** Parse the ingredient section: list items, with plain lines or headings starting new groups. */
export function parseIngredientSection(text: string): { groups: IngredientGroup[]; warnings: string[] } {
  const groups: IngredientGroup[] = [{ title: '', ingredients: [] }]
  const warnings: string[] = []
  for (const raw of splitLines(text)) {
    if (!raw.trim()) continue
    const item = raw.match(/^\s*[-*+]\s+(.*)$/)
    if (item) {
      if (!item[1].trim()) continue
      const { line, warning } = parseIngredientLine(item[1])
      groups[groups.length - 1].ingredients.push(line)
      if (warning) warnings.push(warning)
    } else {
      const title = normalizeText(raw)
        .replace(/^#+\s*/, '')
        .replace(/^[*_]+|[*_]+$/g, '')
        .replace(/:$/, '')
        .trim()
      groups.push({ title, ingredients: [] })
    }
  }
  return { groups: groups.filter((g) => g.ingredients.length > 0), warnings }
}

export interface ParseOptions {
  /** Vault-relative path, e.g. "Meals/Dinner/Burgers.md". Used for the title and a category tag. */
  path?: string
}

function titleFromPath(path: string | undefined): string {
  const file = path?.split('/').pop() ?? ''
  return file.replace(/\.md$/i, '').trim()
}

/** The folder a recipe lives in ("Meals/Dinner/Burgers.md" → "Dinner"). */
export function categoryFromPath(path: string | undefined): string | undefined {
  const parts = path?.split('/') ?? []
  return parts.length > 1 ? parts[parts.length - 2] : undefined
}

export function parseRecipeMd(markdown: string, options: ParseOptions = {}): ParseResult {
  const lines = stripFrontmatter(splitLines(markdown))
  const separators = lines.flatMap((l, i) => (SEPARATOR.test(l) ? [i] : []))
  const warnings: string[] = []

  const headerEnd = separators[0] ?? lines.length
  const ingredientsEnd = separators[1] ?? lines.length
  const header = parseHeader(lines.slice(0, headerEnd))
  const { groups, warnings: ingredientWarnings } = parseIngredientSection(
    lines.slice(headerEnd + 1, ingredientsEnd).join('\n'),
  )
  const instructions = separators[1] !== undefined ? lines.slice(ingredientsEnd + 1).join('\n').trim() : ''

  const title = header.title || titleFromPath(options.path) || 'Untitled recipe'
  // "tag2", "tag3"… are template placeholders, not real tags.
  const placeholderTags = header.tags.filter((t) => /^tag\d+$/i.test(t))
  const tags = [...new Set(header.tags.filter((t) => !placeholderTags.includes(t)))]
  const category = categoryFromPath(options.path)
  if (category && !tags.some((t) => t.toLowerCase() === category.toLowerCase())) tags.push(category)

  if (separators.length === 0) warnings.push('No "---" separator found, so no ingredients could be read.')
  else if (groups.length === 0) warnings.push('No ingredients found.')
  warnings.push(...ingredientWarnings)
  if (placeholderTags.length || TEMPLATE_PHRASES.some((p) => markdown.toLowerCase().includes(p.toLowerCase()))) {
    warnings.push('Contains leftover text from the recipe template. Check it after importing.')
  }

  const recipe: ParsedRecipe = {
    title,
    description: header.description,
    tags,
    yieldsText: header.yieldsText,
    ingredientGroups: groups,
    instructions,
    fridgeDays: DEFAULT_FRIDGE_DAYS,
    source: markdown,
  }
  const grams = yieldGrams(header.yieldsText)
  if (grams) recipe.expectedYieldG = grams
  if (options.path) recipe.sourcePath = options.path
  return { recipe, warnings }
}
