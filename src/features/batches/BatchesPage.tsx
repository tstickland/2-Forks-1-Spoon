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
      {data && <BatchLists data={data} onScale={(b, scale) => updateBatch(household.id, b.id, { scale })} />}
    </>
  )
}

function BatchLists({ data, onScale }: { data: PlanData; onScale: (b: Batch, scale: number) => void }) {
  const cutoff = addDays(today(), -CURRENT_DAYS)
  const hasUpcomingMeals = (b: Batch) => (data.forecasts.get(b.id)?.days ?? []).some((d) => d.date >= today())
  const current = data.batches
    .filter((b) => b.cookDate >= cutoff || hasUpcomingMeals(b))
    .sort((a, b) => a.cookDate.localeCompare(b.cookDate))
  const earlier = data.batches.filter((b) => !current.includes(b))

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
    <BatchRunway
      key={b.id}
      batch={b}
      recipe={data.recipeById.get(b.recipeId)}
      forecast={data.forecasts.get(b.id)!}
      onScale={(scale) => onScale(b, scale)}
    />
  )

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Upcoming and in the fridge</h2>
        {current.length ? current.map(runway) : <p className="text-stone-500">Nothing planned. Add a batch to get started.</p>}
      </section>
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
