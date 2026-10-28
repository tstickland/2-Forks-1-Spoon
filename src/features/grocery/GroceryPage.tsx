import { Link } from 'react-router-dom'
import { formatShort } from '../../domain/dates'
import type { TripList } from '../../domain/grocery'
import type { TripState } from '../../domain/types'
import { Card, PageHeader } from '../../ui/components'
import { PlanGapWarning } from './PlanGapWarning'
import { useGroceryData } from './useGroceryData'

/** How many upcoming trips to show on the overview. */
const TRIPS_SHOWN = 4

export function GroceryPage() {
  const { data, error } = useGroceryData()

  return (
    <>
      <PageHeader title="Groceries">
        <Link to="/groceries/ingredients" className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-stone-300">
          Ingredients
        </Link>
      </PageHeader>
      {error && <p className="mb-3 text-sm text-red-700">Couldn't load groceries: {error}</p>}
      {!data && !error && <p className="text-stone-500">Loading…</p>}
      {data && (
        <div className="space-y-3">
          {data.plan.uncovered.length > 0 && (
            <Card title="Needed before any trip">
              <p className="mb-2 text-sm text-stone-600">
                These batches cook before your next shopping trip. Pick them up on the way, or move the cook day in Batches.
              </p>
              <ul className="space-y-1 text-sm">
                {data.plan.uncovered.map((i) => (
                  <li key={i.key} className="flex justify-between gap-3">
                    <span>{i.name}</span>
                    <span className="text-stone-600">{i.quantity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.plan.trips.slice(0, TRIPS_SHOWN).map((list, i, shown) => (
            <TripCard
              key={list.trip.id}
              list={list}
              state={data.tripStates.get(list.trip.id)}
              // Later trips are always only partly planned; only nag about the next one per store.
              showPlanGap={!shown.slice(0, i).some((earlier) => earlier.trip.store === list.trip.store)}
            />
          ))}
          <p className="text-xs text-stone-500">
            Lists come from batches you've planned that aren't cooked yet. Change the trip days in Settings.
          </p>
        </div>
      )}
    </>
  )
}

function TripCard({ list, state, showPlanGap }: { list: TripList; state?: TripState; showPlanGap: boolean }) {
  const extras = state?.extras ?? []
  const keys = [...list.items.map((i) => i.key), ...extras.map((e) => `x:${e.id}`)]
  const ticked = keys.filter((k) => state?.checked[k]).length
  return (
    <Link to={`/groceries/${list.trip.id}`} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {list.trip.store} · {formatShort(list.trip.date)}
        </h2>
        {keys.length > 0 && (
          <span className="text-sm text-stone-500">
            {ticked}/{keys.length} ticked
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {keys.length === 0 ? 'Nothing to buy for planned batches.' : `${keys.length} to buy`}
        {list.staples.length > 0 && ` · ${list.staples.length} staple${list.staples.length === 1 ? '' : 's'} to check`}
      </p>
      {showPlanGap && list.planGap && <PlanGapWarning gap={list.planGap} store={list.trip.store} compact />}
    </Link>
  )
}
