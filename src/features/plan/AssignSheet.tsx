import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { applyEntryChanges } from '../../data/batches'
import { formatGrams, formatScale } from '../../domain/batch'
import { addDays, dateRange, formatShort, weekdayShort } from '../../domain/dates'
import { slotEaters } from '../../domain/household'
import { assignSlot, defaultPortion, slotEntries } from '../../domain/plan'
import type { Batch, IsoDate, Slot } from '../../domain/types'
import { Button, Input, Sheet } from '../../ui/components'
import { runwaySummary } from '../batches/runwayText'
import type { PlanData } from './usePlanData'

export function AssignSheet({
  data,
  date,
  slot,
  weekEnd,
  onClose,
}: {
  data: PlanData
  date: IsoDate
  slot: Slot
  /** Last day of the week; "also add to" offers the days after `date` up to here. */
  weekEnd: IsoDate
  onClose: () => void
}) {
  const { household } = useHouseholdContext()
  const eaters = slotEaters(household, slot)
  const existing = slotEntries(data.entries, date, slot.id)
  const firstExisting = [...existing.values()][0]

  const ready = data.batches.filter((b) => b.cookDate <= date).sort((a, b) => b.cookDate.localeCompare(a.cookDate))
  const later = data.batches.filter((b) => b.cookDate > date).sort((a, b) => a.cookDate.localeCompare(b.cookDate))

  const [batchId, setBatchId] = useState(firstExisting?.batchId ?? ready[0]?.id ?? '')
  const [grams, setGrams] = useState<Record<string, string>>(() =>
    Object.fromEntries(eaters.map((m) => [m.uid, String(existing.get(m.uid)?.grams ?? defaultPortion(household, m.uid, slot.id))])),
  )
  const [eating, setEating] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(eaters.map((m) => [m.uid, existing.size === 0 || existing.has(m.uid)])),
  )
  const followingDays = date < weekEnd ? dateRange(addDays(date, 1), weekEnd) : []
  const [alsoOn, setAlsoOn] = useState<Set<IsoDate>>(new Set())

  const gramsByPerson = Object.fromEntries(
    eaters.filter((m) => eating[m.uid] && Number(grams[m.uid]) > 0).map((m) => [m.uid, Math.round(Number(grams[m.uid]))]),
  )
  const canSave = Boolean(batchId) && Object.keys(gramsByPerson).length > 0

  const write = (assignment: Parameters<typeof assignSlot>[3]) => {
    const changes = assignSlot(household, slot, [date, ...alsoOn].sort(), assignment)
    applyEntryChanges(household.id, changes).catch((e: Error) => alert(`Couldn't save: ${e.message}`))
    onClose()
  }

  const toggleDay = (d: IsoDate) => {
    const next = new Set(alsoOn)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    setAlsoOn(next)
  }

  return (
    <Sheet title={`${slot.name} · ${formatShort(date)}`} onClose={onClose}>
      <div className="space-y-4">
        <section>
          <h3 className="mb-1 text-sm font-semibold">Batch</h3>
          {ready.length === 0 && later.length === 0 && <p className="text-sm text-stone-600">No batches yet.</p>}
          <ul className="space-y-1">
            {ready.map((b) => (
              <BatchOption key={b.id} batch={b} data={data} date={date} selected={b.id === batchId} onSelect={() => setBatchId(b.id)} />
            ))}
          </ul>
          {later.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-stone-500">Cooked after this day ({later.length})</summary>
              <ul className="mt-1 space-y-1">
                {later.map((b) => (
                  <BatchOption key={b.id} batch={b} data={data} date={date} selected={b.id === batchId} onSelect={() => setBatchId(b.id)} />
                ))}
              </ul>
            </details>
          )}
          <Link
            to={`/batches/new?cookDate=${date}&returnTo=/`}
            className="mt-2 inline-block text-sm font-medium text-brand-700"
          >
            + Plan a new batch
          </Link>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Portions (g)</h3>
          <div className="space-y-2">
            {eaters.map((m) => (
              <label key={m.uid} className="flex items-center gap-3">
                {eaters.length > 1 && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-700"
                    checked={eating[m.uid]}
                    onChange={(e) => setEating({ ...eating, [m.uid]: e.target.checked })}
                  />
                )}
                <span className="w-20 shrink-0 text-sm">{m.name.split(' ')[0]}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${m.name.split(' ')[0]} grams`}
                  disabled={!eating[m.uid]}
                  value={grams[m.uid]}
                  onChange={(e) => setGrams({ ...grams, [m.uid]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </section>

        {followingDays.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Also add to</h3>
            <div className="flex flex-wrap gap-2">
              {followingDays.map((d) => {
                const taken = slotEntries(data.entries, d, slot.id).size > 0
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    title={taken ? 'Already planned, will be replaced' : undefined}
                    className={`rounded-full px-3 py-1 text-sm ring-1 ${
                      alsoOn.has(d) ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-stone-700 ring-stone-300'
                    }`}
                  >
                    {weekdayShort(d)}
                    {taken && '*'}
                  </button>
                )
              })}
            </div>
            {followingDays.some((d) => alsoOn.has(d) && slotEntries(data.entries, d, slot.id).size > 0) && (
              <p className="mt-1 text-xs text-stone-500">* already planned; it will be replaced.</p>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {existing.size > 0 ? (
            <Button variant="danger" onClick={() => write(null)}>
              Clear{alsoOn.size ? ` ${alsoOn.size + 1} days` : ''}
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={!canSave} onClick={() => write({ batchId, gramsByPerson })}>
            Save{alsoOn.size ? ` to ${alsoOn.size + 1} days` : ''}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function BatchOption({
  batch,
  data,
  date,
  selected,
  onSelect,
}: {
  batch: Batch
  data: PlanData
  date: IsoDate
  selected: boolean
  onSelect: () => void
}) {
  const recipe = data.recipeById.get(batch.recipeId)
  const forecast = data.forecasts.get(batch.id)!
  const notCooked = batch.cookDate > date
  const tooOld = date > forecast.fridgeUntil
  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 ring-1 ${selected ? 'bg-brand-50 ring-brand-600' : 'ring-stone-200'}`}
      >
        <input type="radio" name="batch" className="mt-1 h-4 w-4 accent-brand-700" checked={selected} onChange={onSelect} />
        <div className="min-w-0 text-sm">
          <div className="font-medium">{recipe?.title ?? 'Deleted recipe'}</div>
          <div className="text-xs text-stone-600">
            Cook {formatShort(batch.cookDate)} · {formatScale(batch.scale)}
            {forecast.weightG !== undefined && ` · ${forecast.estimated ? '~' : ''}${formatGrams(forecast.weightG)}`}
          </div>
          <div className="text-xs text-stone-600">{runwaySummary(forecast)}</div>
          {notCooked && <div className="text-xs text-red-700">Not cooked yet on this day</div>}
          {!notCooked && tooOld && <div className="text-xs text-amber-700">Past fridge life on this day: freeze a portion</div>}
        </div>
      </label>
    </li>
  )
}
