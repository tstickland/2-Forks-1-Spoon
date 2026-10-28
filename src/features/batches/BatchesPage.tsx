import { Link } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { updateBatch } from '../../data/batches'
import { addDays, today } from '../../domain/dates'
import type { Batch } from '../../domain/types'
import { Card, PageHeader } from '../../ui/components'
import { usePlanData, type PlanData } from '../plan/usePlanData'
import { BatchRunway } from './Runway'

/** Batches cooked within this many days are still "current" (in the fridge or being eaten). */
const CURRENT_DAYS = 7

export function BatchesPage() {
  const { household } = useHouseholdContext()
  const { data, error } = usePlanData()

  return (
    <>
      <PageHeader title="Batches">
        <Link to="/batches/new" className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">
          New batch
        </Link>
      </PageHeader>
      {error && <p className="mb-3 text-sm text-red-700">Couldn't load batches: {error}</p>}
      {!data && !error && <p className="text-stone-500">Loading…</p>}
      {data && <BatchLists data={data} onUpdate={(b, changes) => updateBatch(household.id, b.id, changes)} />}
    </>
  )
}

function BatchLists({ data, onUpdate }: { data: PlanData; onUpdate: (b: Batch, changes: Partial<Omit<Batch, 'id'>>) => void }) {
  const cutoff = addDays(today(), -CURRENT_DAYS)
  const forecast = (b: Batch) => data.forecasts.get(b.id)!
  const hasUpcomingMeals = (b: Batch) => forecast(b).days.some((d) => d.date >= today())
  const current = data.batches
    .filter((b) => b.cookDate >= cutoff || hasUpcomingMeals(b))
    .sort((a, b) => a.cookDate.localeCompare(b.cookDate))
  // Older batches with frozen food nobody has planned yet.
  const inFreezer = data.batches.filter((b) => !current.includes(b) && forecast(b).freezerLeftG > 0)
  const earlier = data.batches.filter((b) => !current.includes(b) && !inFreezer.includes(b))

  if (data.batches.length === 0) {
    return (
      <Card title="No batches yet">
        <p className="mb-3 text-stone-600">
          A batch is one cooking session of a recipe. Plan one, then assign it to lunches and dinners on the Plan tab
          to see how long it will last.
        </p>
        <Link to="/batches/new" className="inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">
          Plan a batch
        </Link>
      </Card>
    )
  }

  const runway = (b: Batch) => (
    <BatchRunway key={b.id} batch={b} recipe={data.recipeById.get(b.recipeId)} forecast={forecast(b)} onUpdate={(c) => onUpdate(b, c)} />
  )

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Upcoming and in the fridge</h2>
        {current.length ? current.map(runway) : <p className="text-stone-500">Nothing planned. Add a batch to get started.</p>}
      </section>
      {inFreezer.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">In the freezer</h2>
          <p className="text-xs text-stone-500">Frozen portions not planned yet. Pick them for a meal on the Plan tab.</p>
          {inFreezer.map(runway)}
        </section>
      )}
      {earlier.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-stone-500">
            Earlier ({earlier.length})
          </summary>
          <div className="mt-2 space-y-2">{earlier.map(runway)}</div>
        </details>
      )}
    </div>
  )
}
