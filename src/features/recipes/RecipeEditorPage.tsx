import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { saveRecipe, useRecipes } from '../../data/recipes'
import { MACRO_KEYS } from '../../domain/macros'
import { DEFAULT_FRIDGE_DAYS, parseIngredientSection, type ParsedRecipe } from '../../domain/recipemd/parse'
import { ingredientSectionMd } from '../../domain/recipemd/serialize'
import type { Macros, Recipe } from '../../domain/types'
import { Button, Card, Field, Input, TextArea } from '../../ui/components'

export function RecipeEditorPage() {
  const { id } = useParams()
  const { household } = useHouseholdContext()
  const { recipes } = useRecipes(household.id)

  if (id && recipes === null) return <p className="text-stone-500">Loading…</p>
  const existing = id ? recipes?.find((r) => r.id === id) : undefined
  if (id && !existing) {
    return (
      <Card title="Recipe not found">
        <Link to="/recipes" className="text-brand-700">
          Back to recipes
        </Link>
      </Card>
    )
  }
  // Keyed by id only: edits the other phone makes while this form is open don't wipe the draft.
  return <RecipeForm key={existing?.id ?? 'new'} householdId={household.id} existing={existing} />
}

const MACRO_LABELS: Record<keyof Macros, string> = { kcal: 'Calories', protein: 'Protein (g)', carbs: 'Carbs (g)', fat: 'Fat (g)' }

function numberText(n: number | undefined): string {
  return n === undefined ? '' : String(n)
}

/** Blank → undefined; otherwise the number (NaN if not a number). */
function optionalNumber(text: string): number | undefined {
  return text.trim() === '' ? undefined : Number(text)
}

function RecipeForm({ householdId, existing }: { householdId: string; existing?: Recipe }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [yieldG, setYieldG] = useState(numberText(existing?.expectedYieldG))
  const [fridgeDays, setFridgeDays] = useState(String(existing?.fridgeDays ?? DEFAULT_FRIDGE_DAYS))
  const [macros, setMacros] = useState<Record<keyof Macros, string>>({
    kcal: numberText(existing?.macrosTotal?.kcal),
    protein: numberText(existing?.macrosTotal?.protein),
    carbs: numberText(existing?.macrosTotal?.carbs),
    fat: numberText(existing?.macrosTotal?.fat),
  })
  const [ingredients, setIngredients] = useState(existing ? ingredientSectionMd(existing.ingredientGroups) : '')
  const [instructions, setInstructions] = useState(existing?.instructions ?? '')

  const parsed = useMemo(() => parseIngredientSection(ingredients), [ingredients])
  const ingredientCount = parsed.groups.reduce((n, g) => n + g.ingredients.length, 0)

  const yieldValue = optionalNumber(yieldG)
  const fridgeValue = Number(fridgeDays)
  const macroValues = MACRO_KEYS.map((k) => optionalNumber(macros[k]))
  const macrosFilled = macroValues.filter((v) => v !== undefined).length

  const problems = [
    !title.trim() && 'Give the recipe a title.',
    yieldValue !== undefined && !(yieldValue > 0) && 'Cooked weight must be a positive number of grams.',
    !(Number.isInteger(fridgeValue) && fridgeValue >= 0) && 'Fridge days must be a whole number.',
    macrosFilled > 0 && macrosFilled < 4 && 'Fill in all four macros, or leave them all blank.',
    macroValues.some((v) => v !== undefined && !(v >= 0)) && 'Macros must be numbers.',
  ].filter(Boolean) as string[]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (problems.length) return
    const base: Partial<ParsedRecipe> = existing ? { ...existing } : {}
    delete (base as Partial<Recipe>).id
    const recipe: ParsedRecipe = {
      ...base,
      title: title.trim(),
      description: description.trim(),
      tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))],
      yieldsText: existing?.yieldsText ?? '',
      expectedYieldG: yieldValue,
      fridgeDays: fridgeValue,
      macrosTotal:
        macrosFilled === 4
          ? { kcal: macroValues[0]!, protein: macroValues[1]!, carbs: macroValues[2]!, fat: macroValues[3]! }
          : undefined,
      ingredientGroups: parsed.groups,
      instructions: instructions.trim(),
    }
    const { id, done } = saveRecipe(householdId, recipe, existing?.id)
    done.catch((err: Error) => alert(`Couldn't save: ${err.message}`))
    navigate(`/recipes/${id}`, { replace: !existing })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Link to={existing ? `/recipes/${existing.id}` : '/recipes'} className="text-sm text-stone-500">
          ← Cancel
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{existing ? 'Edit recipe' : 'New recipe'}</h1>
      </div>

      <Card>
        <div className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Description">
            <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Tags (comma separated)">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="protein, Dinner, freezer" />
          </Field>
        </div>
      </Card>

      <Card title="Weight and storage">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cooked weight at 1× (g)">
            <Input type="number" inputMode="decimal" min={0} value={yieldG} onChange={(e) => setYieldG(e.target.value)} />
          </Field>
          <Field label="Keeps in fridge (days)">
            <Input type="number" inputMode="numeric" min={0} value={fridgeDays} onChange={(e) => setFridgeDays(e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-sm text-stone-500">
          Weigh everything you cooked (minus the container). Planning uses this to work out how many days a batch lasts.
          {existing?.yieldsText && ` Originally written as "${existing.yieldsText}".`}
        </p>
      </Card>

      <Card title="Macros for the whole recipe (1×)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MACRO_KEYS.map((k) => (
            <Field key={k} label={MACRO_LABELS[k]}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={macros[k]}
                onChange={(e) => setMacros({ ...macros, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">Totals for everything in the pot, e.g. from your tracking app.</p>
      </Card>

      <Card title="Ingredients">
        <TextArea
          rows={Math.max(8, ingredients.split('\n').length + 1)}
          className="font-mono text-sm"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={'- *600 g* lean ground beef\n- *2 tbsp* garlic powder\n\n## Sauce\n- *100 mL* soy sauce'}
        />
        <p className="mt-2 text-sm text-stone-500">
          One per line as <code>- *amount* name</code>. Start a group with <code>## Group name</code>.{' '}
          <span className="text-stone-700">
            {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}
            {parsed.groups.filter((g) => g.title).length > 0 && ` in ${parsed.groups.length} groups`}.
          </span>
        </p>
        {parsed.warnings.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
            {parsed.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Instructions">
        <TextArea
          rows={Math.max(6, instructions.split('\n').length + 1)}
          className="text-sm"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={'1. Cook the beef\n2. Add the sauce'}
        />
        <p className="mt-2 text-sm text-stone-500">Markdown: numbered lists, **bold**, nested steps with a tab.</p>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-stone-200 bg-stone-50/95 px-4 py-3">
        {problems[0] && <span className="text-sm text-red-700">{problems[0]}</span>}
        <Button type="submit" disabled={problems.length > 0}>
          Save
        </Button>
      </div>
    </form>
  )
}
