import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { saveBatch } from '../../data/batches'
import { useRecipes } from '../../data/recipes'
import { batchWeight, formatGrams } from '../../domain/batch'
import { today } from '../../domain/dates'
import { Button, Card, Field, Input } from '../../ui/components'

export function NewBatchPage() {
  const { household } = useHouseholdContext()
  const { recipes } = useRecipes(household.id)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('returnTo')
  const [recipeId, setRecipeId] = useState(params.get('recipeId') ?? '')
  const [cookDate, setCookDate] = useState(params.get('cookDate') ?? today())
  const [scale, setScale] = useState('1')

  const recipe = recipes?.find((r) => r.id === recipeId)
  const scaleValue = Number(scale)
  const validScale = scaleValue > 0
  const weight = recipe && validScale ? batchWeight({ scale: scaleValue }, recipe) : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!recipe || !validScale || !cookDate) return
    const { id, done } = saveBatch(household.id, {
      recipeId: recipe.id,
      cookDate,
      scale: scaleValue,
      status: 'planned',
      frozenG: 0,
      notes: '',
    })
    done.catch((err: Error) => alert(`Couldn't save the batch: ${err.message}`))
    navigate(returnTo ?? `/batches/${id}`, { replace: true })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Link to={returnTo ?? '/batches'} className="text-sm text-stone-500">
          ← Cancel
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Plan a batch</h1>
      </div>

      <Card>
        <div className="space-y-3">
          <Field label="Recipe">
            <select
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              required
            >
              <option value="">Choose a recipe…</option>
              {recipes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cook date">
              <Input type="date" value={cookDate} onChange={(e) => setCookDate(e.target.value)} required />
            </Field>
            <Field label="Scale (× recipe)">
              <Input type="number" inputMode="decimal" min={0.25} step={0.25} value={scale} onChange={(e) => setScale(e.target.value)} />
            </Field>
          </div>
          {recipe && (
            <p className="text-sm text-stone-600">
              {weight
                ? `About ${formatGrams(weight.grams)} cooked. You can weigh it after cooking to make the plan exact.`
                : `${recipe.title} has no cooked weight yet. Weigh this batch after cooking and the app will remember it for next time.`}
            </p>
          )}
          {recipes?.length === 0 && (
            <p className="text-sm text-stone-600">
              No recipes yet. <Link to="/recipes/import" className="text-brand-700 underline">Import some first</Link>.
            </p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!recipe || !validScale || !cookDate}>
          Create batch
        </Button>
      </div>
    </form>
  )
}
