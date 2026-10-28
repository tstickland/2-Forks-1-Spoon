import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { deleteBatch, updateBatch } from '../../data/batches'
import { updateRecipe } from '../../data/recipes'
import { formatGrams, formatScale, scaledAmountText, yieldPerScale } from '../../domain/batch'
import { formatShort } from '../../domain/dates'
import type { BatchForecast } from '../../domain/forecast'
import type { Batch, Household, MealEntry, Recipe } from '../../domain/types'
import { Button, Card, Field, Input } from '../../ui/components'
import { usePlanData } from '../plan/usePlanData'
import { BatchRunway } from './Runway'

export function BatchPage() {
  const { id } = useParams()
  const { household } = useHouseholdContext()
  const { data } = usePlanData()
  const navigate = useNavigate()

  if (!data) return <p className="text-stone-500">Loading…</p>
  const batch = data.batchById.get(id ?? '')
  if (!batch) {
    return (
      <Card title="Batch not found">
        <Link to="/batches" className="text-brand-700">
          Back to batches
        </Link>
      </Card>
    )
  }
  const recipe = data.recipeById.get(batch.recipeId)
  const forecast = data.forecasts.get(batch.id)!
  const meals = data.entries.filter((e) => e.batchId === batch.id)

  const remove = () => {
    const note = meals.length ? ` This also removes ${meals.length} planned meal${meals.length === 1 ? '' : 's'}.` : ''
    if (!confirm(`Delete this batch of ${recipe?.title ?? 'a deleted recipe'}?${note}`)) return
    deleteBatch(household.id, batch.id).catch((e: Error) => alert(e.message))
    navigate('/batches')
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/batches" className="text-sm text-stone-500">
          ← Batches
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{recipe?.title ?? 'Deleted recipe'}</h1>
        {recipe && (
          <Link to={`/recipes/${recipe.id}`} className="text-sm text-brand-700">
            View recipe
          </Link>
        )}
      </div>

      <BatchRunway
        batch={batch}
        recipe={recipe}
        forecast={forecast}
        link={false}
        onScale={(scale) => updateBatch(household.id, batch.id, { scale })}
      />

      <CookedWeight key={`${batch.id}-${batch.actualWeightG}`} householdId={household.id} batch={batch} recipe={recipe} />
      <Details key={`${batch.cookDate}-${batch.scale}`} householdId={household.id} batch={batch} />
      <PlannedMeals household={household} meals={meals} forecast={forecast} />
      {recipe && <ScaledIngredients recipe={recipe} scale={batch.scale} />}

      <div className="flex justify-end">
        <Button variant="danger" onClick={remove}>
          Delete batch
        </Button>
      </div>
    </div>
  )
}

function CookedWeight({ householdId, batch, recipe }: { householdId: string; batch: Batch; recipe?: Recipe }) {
  const [editing, setEditing] = useState(batch.actualWeightG === undefined)
  const [grams, setGrams] = useState(batch.actualWeightG !== undefined ? String(batch.actualWeightG) : '')
  // Default to remembering the weight when the recipe doesn't have one yet.
  const [saveToRecipe, setSaveToRecipe] = useState(!recipe?.expectedYieldG)
  const value = Number(grams)
  const valid = grams.trim() !== '' && value > 0
  const perScale = valid ? yieldPerScale(value, batch.scale) : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    updateBatch(householdId, batch.id, { actualWeightG: Math.round(value), status: 'cooked' }).catch((err: Error) => alert(err.message))
    if (saveToRecipe && recipe && perScale) {
      updateRecipe(householdId, recipe.id, { expectedYieldG: perScale }).catch((err: Error) => alert(err.message))
    }
    setEditing(false)
  }

  if (!editing && batch.actualWeightG !== undefined) {
    return (
      <Card title="Cooked weight" action={<button className="text-sm text-brand-700" onClick={() => setEditing(true)}>Change</button>}>
        <p>
          Weighed at <span className="font-semibold">{formatGrams(batch.actualWeightG)}</span>. The plan uses this instead
          of the estimate.
        </p>
      </Card>
    )
  }

  return (
    <Card title="Record cooked weight">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-stone-600">
          After cooking, put the empty container on the scale, zero it, add all the food and enter the weight.
        </p>
        <Field label="Cooked weight (g)">
          <Input type="number" inputMode="numeric" min={1} value={grams} onChange={(e) => setGrams(e.target.value)} />
        </Field>
        {recipe && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-700"
              checked={saveToRecipe}
              onChange={(e) => setSaveToRecipe(e.target.checked)}
            />
            <span>
              Use for future batches: set {recipe.title}'s cooked weight at 1× to{' '}
              {perScale ? formatGrams(perScale) : 'this ÷ the scale'}
              {recipe.expectedYieldG ? ` (currently ${formatGrams(recipe.expectedYieldG)})` : ''}.
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          {batch.actualWeightG !== undefined && (
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={!valid}>
            Save weight
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Details({ householdId, batch }: { householdId: string; batch: Batch }) {
  const [cookDate, setCookDate] = useState(batch.cookDate)
  const [scale, setScale] = useState(String(batch.scale))
  const value = Number(scale)
  const changed = cookDate !== batch.cookDate || value !== batch.scale
  const valid = Boolean(cookDate) && value > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) updateBatch(householdId, batch.id, { cookDate, scale: value }).catch((err: Error) => alert(err.message))
  }

  return (
    <Card title="Cook date and scale">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cook date">
            <Input type="date" value={cookDate} onChange={(e) => setCookDate(e.target.value)} />
          </Field>
          <Field label="Scale (× recipe)">
            <Input type="number" inputMode="decimal" min={0.25} step={0.25} value={scale} onChange={(e) => setScale(e.target.value)} />
          </Field>
        </div>
        {changed && (
          <div className="flex justify-end">
            <Button type="submit" disabled={!valid}>
              Save
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

function PlannedMeals({ household, meals, forecast }: { household: Household; meals: MealEntry[]; forecast: BatchForecast }) {
  const name = (uid: string) => household.members.find((m) => m.uid === uid)?.name.split(' ')[0] ?? 'Someone'
  // Personal slots are obvious from the name; only say which meal for shared ones ("dinner").
  const slotNote = (id: string) => {
    const slot = household.slots.find((s) => s.id === id)
    return slot?.shared ? ` (${slot.name.toLowerCase()})` : ''
  }
  if (forecast.days.length === 0) {
    return (
      <Card title="Planned meals">
        <p className="text-stone-600">
          Nothing planned from this batch yet. Assign it to meals on the <Link to="/" className="text-brand-700 underline">Plan</Link> tab.
        </p>
      </Card>
    )
  }
  return (
    <Card title="Planned meals">
      <ul className="divide-y divide-stone-100 text-sm">
        {forecast.days.map((day) => {
          const short = day.remainingG !== undefined && day.remainingG < 0
          const late = forecast.pastFridgeLife.some((p) => p.date === day.date)
          return (
            <li key={day.date} className="flex items-start justify-between gap-3 py-2">
              <div>
                <div className="font-medium">{formatShort(day.date)}</div>
                <div className="text-stone-600">
                  {meals
                    .filter((m) => m.date === day.date)
                    .map((m) => `${name(m.personUid)} ${m.grams} g${slotNote(m.slotId)}`)
                    .join(' · ')}
                </div>
                {late && <div className="text-xs text-red-700">Past fridge life: freeze this portion</div>}
              </div>
              <div className={`shrink-0 text-right ${short ? 'font-semibold text-red-700' : 'text-stone-600'}`}>
                {day.remainingG === undefined ? '' : short ? `${formatGrams(-day.remainingG)} short` : `${formatGrams(day.remainingG)} left`}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function ScaledIngredients({ recipe, scale }: { recipe: Recipe; scale: number }) {
  return (
    <Card title={`Ingredients at ${formatScale(scale)}`}>
      {recipe.ingredientGroups.map((g, i) => (
        <section key={i} className="mb-3 last:mb-0">
          {g.title && <h3 className="mb-1 text-sm font-semibold text-stone-700">{g.title}</h3>}
          <ul className="space-y-1">
            {g.ingredients.map((line, j) => {
              const amount = scaledAmountText(line, scale)
              return (
                <li key={j}>
                  {amount && <span className="mr-1.5 font-semibold text-stone-800">{amount}</span>}
                  {line.name}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </Card>
  )
}
