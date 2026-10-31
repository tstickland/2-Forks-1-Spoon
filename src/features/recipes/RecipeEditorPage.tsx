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

type MacroText = Record<keyof Macros, string>

function macroText(m: Macros | undefined): MacroText {
  return { kcal: numberText(m?.kcal), protein: numberText(m?.protein), carbs: numberText(m?.carbs), fat: numberText(m?.fat) }
}

/** All four blank → no macros; all four numbers → macros; anything else → a problem to show. */
function readMacros(text: MacroText): { value?: Macros; problem?: string } {
  const values = MACRO_KEYS.map((k) => optionalNumber(text[k]))
  const filled = values.filter((v) => v !== undefined).length
  if (filled === 0) return {}
  if (filled < 4) return { problem: 'Fill in all four macros, or leave them all blank.' }
  if (values.some((v) => !(v! >= 0))) return { problem: 'Macros must be numbers.' }
  return { value: { kcal: values[0]!, protein: values[1]!, carbs: values[2]!, fat: values[3]! } }
}

function MacroFields({ value, onChange }: { value: MacroText; onChange: (v: MacroText) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {MACRO_KEYS.map((k) => (
        <Field key={k} label={MACRO_LABELS[k]}>
          <Input type="number" inputMode="decimal" min={0} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </Field>
      ))}
    </div>
  )
}

function RecipeForm({ householdId, existing }: { householdId: string; existing?: Recipe }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [yieldG, setYieldG] = useState(numberText(existing?.expectedYieldG))
  const [fridgeDays, setFridgeDays] = useState(String(existing?.fridgeDays ?? DEFAULT_FRIDGE_DAYS))
  const [macros, setMacros] = useState(macroText(existing?.macrosTotal))
  const [ingredients, setIngredients] = useState(existing ? ingredientSectionMd(existing.ingredientGroups) : '')
  const [perMeal, setPerMeal] = useState(existing?.perMeal?.length ? ingredientSectionMd([{ title: '', ingredients: existing.perMeal }]) : '')
  const [perMealMacros, setPerMealMacros] = useState(macroText(existing?.perMealMacros))
  const [instructions, setInstructions] = useState(existing?.instructions ?? '')

  const parsed = useMemo(() => parseIngredientSection(ingredients), [ingredients])
  const ingredientCount = parsed.groups.reduce((n, g) => n + g.ingredients.length, 0)
  const parsedPerMeal = useMemo(() => parseIngredientSection(perMeal), [perMeal])
  const perMealLines = parsedPerMeal.groups.flatMap((g) => g.ingredients)

  const yieldValue = optionalNumber(yieldG)
  const fridgeValue = Number(fridgeDays)
  const totalMacros = readMacros(macros)
  const addOnMacros = readMacros(perMealMacros)

  const problems = [
    !title.trim() && 'Give the recipe a title.',
    yieldValue !== undefined && !(yieldValue > 0) && 'Cooked weight must be a positive number of grams.',
    !(Number.isInteger(fridgeValue) && fridgeValue >= 0) && 'Fridge days must be a whole number.',
    totalMacros.problem,
    addOnMacros.problem && `Per-meal macros: ${addOnMacros.problem.toLowerCase()}`,
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
      macrosTotal: totalMacros.value,
      ingredientGroups: parsed.groups,
      perMeal: perMealLines.length ? perMealLines : undefined,
      perMealMacros: perMealLines.length ? addOnMacros.value : undefined,
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
          Weigh everything you cooked ahead (minus the container), not the per-meal add-ons. Planning uses this to work
          out how many days a batch lasts.
          {existing?.yieldsText && ` Originally written as "${existing.yieldsText}".`}
        </p>
      </Card>

      <Card title="Macros for the cooked-ahead part (1×)">
        <MacroFields value={macros} onChange={setMacros} />
        <p className="mt-2 text-sm text-stone-500">Totals for everything in the pot, e.g. from your tracking app.</p>
      </Card>

      <Card title="Ingredients (cooked ahead)">
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

      <Card title="Added per meal (optional)">
        <p className="mb-2 text-sm text-stone-500">
          Things added fresh to each meal when you assemble it: a tortilla per wrap, cheese and pepperoni on a bowl.
          They aren't part of the batch or its weight. Shopping lists buy them for each planned meal.
        </p>
        <TextArea
          rows={Math.max(3, perMeal.split('\n').length + 1)}
          className="font-mono text-sm"
          aria-label="Added per meal"
          value={perMeal}
          onChange={(e) => setPerMeal(e.target.value)}
          placeholder={'- *1* tortilla wrap\n- *30 g* shredded mozzarella'}
        />
        {parsedPerMeal.warnings.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
            {parsedPerMeal.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
        {perMealLines.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-1 text-sm font-semibold">Macros for one meal's add-ons</h3>
            <MacroFields value={perMealMacros} onChange={setPerMealMacros} />
          </div>
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
