import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { updateBatch } from '../../data/batches'
import { addDays, dateRange, dayOfMonth, daysBetween, formatShort, startOfWeek, today, weekdayShort } from '../../domain/dates'
import { slotEntries } from '../../domain/plan'
import { forecastProblems } from '../../domain/forecast'
import type { Batch, IsoDate, Slot } from '../../domain/types'
import { Button, PageHeader } from '../../ui/components'
import { BatchRunway } from '../batches/Runway'
import { batchTint } from '../batches/runwayText'
import { AssignSheet } from './AssignSheet'
import { usePlanData, type PlanData } from './usePlanData'
import { WeekSheet } from './WeekSheet'

const WEEKS_SHOWN = 2

export function PlanPage() {
  const { household } = useHouseholdContext()
  const thisWeek = startOfWeek(today(), 'sunday')
  const [weekStart, setWeekStart] = useState(thisWeek)
  const { data, error } = usePlanData(weekStart)
  const [editing, setEditing] = useState<{ date: IsoDate; slot: Slot } | null>(null)
  const [weekMenu, setWeekMenu] = useState<IsoDate | null>(null)

  const days = dateRange(weekStart, addDays(weekStart, WEEKS_SHOWN * 7 - 1))

  return (
    <>
      <PageHeader title="Plan">
        <div className="flex items-center gap-1">
          <Link to={`/macros?week=${weekStart}`} className="mr-1 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-stone-300">
            Macros
          </Link>
          <Button variant="secondary" className="!px-3" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ‹
          </Button>
          {weekStart !== thisWeek && (
            <Button variant="secondary" className="!px-3" onClick={() => setWeekStart(thisWeek)}>
              Today
            </Button>
          )}
          <Button variant="secondary" className="!px-3" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            ›
          </Button>
        </div>
      </PageHeader>

      {error && <p className="mb-3 text-sm text-red-700">Couldn't load the plan: {error}</p>}
      {!data && !error && <p className="text-stone-500">Loading…</p>}
      {data && (
        <div className="space-y-6">
          <Attention data={data} batches={batchesInView(data, days)} />
          <PlanGrid
            data={data}
            slots={household.slots}
            days={days}
            onEdit={(date, slot) => setEditing({ date, slot })}
            onWeekMenu={setWeekMenu}
          />
          <RunwayList data={data} batches={batchesInView(data, days)} days={days} onUpdate={(id, changes) => updateBatch(household.id, id, changes)} />
        </div>
      )}

      {data && editing && (
        <AssignSheet
          data={data}
          date={editing.date}
          slot={editing.slot}
          weekEnd={addDays(startOfWeek(editing.date, 'sunday'), 6)}
          onClose={() => setEditing(null)}
        />
      )}
      {data && weekMenu && <WeekSheet data={data} weekStart={weekMenu} onClose={() => setWeekMenu(null)} />}
    </>
  )
}

function PlanGrid({
  data,
  slots,
  days,
  onEdit,
  onWeekMenu,
}: {
  data: PlanData
  slots: Slot[]
  days: IsoDate[]
  onEdit: (date: IsoDate, slot: Slot) => void
  onWeekMenu: (weekStart: IsoDate) => void
}) {
  const weeks = [] as IsoDate[][]
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  const columns = `3rem repeat(${slots.length}, minmax(0, 1fr))`

  return (
    <div className="space-y-4">
      {weeks.map((week) => (
        <section key={week[0]}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">Week of {formatShort(week[0])}</h2>
            <button
              className="rounded-lg px-2 text-lg leading-none text-stone-500 hover:bg-stone-200"
              aria-label={`Week of ${formatShort(week[0])} options`}
              onClick={() => onWeekMenu(week[0])}
            >
              ⋯
            </button>
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
            <div className="grid border-b border-stone-200 bg-stone-50 text-xs font-medium text-stone-600" style={{ gridTemplateColumns: columns }}>
              <div />
              {slots.map((s) => (
                <div key={s.id} className="truncate px-1 py-1.5 text-center">
                  {s.name}
                </div>
              ))}
            </div>
            {week.map((date) => (
              <div
                key={date}
                className={`grid border-b border-stone-100 last:border-b-0 ${date === today() ? 'bg-brand-50' : ''}`}
                style={{ gridTemplateColumns: columns }}
              >
                <div className="flex flex-col items-center justify-center py-1 text-xs">
                  <span className="text-stone-500">{weekdayShort(date)}</span>
                  <span className={`font-semibold ${date === today() ? 'text-brand-700' : ''}`}>{dayOfMonth(date)}</span>
                </div>
                {slots.map((slot) => (
                  <PlanCell key={slot.id} data={data} date={date} slot={slot} onClick={() => onEdit(date, slot)} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function PlanCell({ data, date, slot, onClick }: { data: PlanData; date: IsoDate; slot: Slot; onClick: () => void }) {
  const cell = [...slotEntries(data.entries, date, slot.id).values()]
  const label = `${slot.name}, ${formatShort(date)}`
  if (cell.length === 0) {
    return (
      <button aria-label={`Plan ${label}`} onClick={onClick} className="m-0.5 rounded-lg border border-dashed border-stone-200 text-lg text-stone-300 hover:bg-stone-50">
        +
      </button>
    )
  }
  // Everyone in a cell normally eats the same batch; show the first and flag any trouble.
  const batch = data.batchById.get(cell[0].batchId)
  const recipe = batch && data.recipeById.get(batch.recipeId)
  const forecast = batch && data.forecasts.get(batch.id)
  const short = forecast?.days.some((d) => d.date === date && d.remainingG !== undefined && d.remainingG < 0)
  const pastFridge = forecast?.pastFridgeLife.some((p) => p.date === date)
  // Past fridge life is only a problem until enough has been frozen to cover it.
  const fromFreezer = pastFridge && forecast!.freezeMoreG === 0
  const late = pastFridge && !fromFreezer
  const early = batch && date < batch.cookDate
  const trouble = short || late || early
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`m-0.5 min-h-12 rounded-lg px-1.5 py-1 text-left ring-1 ${batch ? batchTint(batch.id) : 'bg-stone-100 ring-stone-200'} ${trouble ? '!ring-2 !ring-red-500' : ''}`}
    >
      <span className="line-clamp-2 text-xs font-medium leading-tight">{recipe?.title ?? 'Deleted batch'}</span>
      <span className="text-[11px] text-stone-600">
        {cell.map((e) => e.grams).join(' · ')} g
        {trouble && <span className="ml-1 font-semibold text-red-700">{short ? 'short' : late ? 'freeze' : 'not cooked'}</span>}
        {!trouble && fromFreezer && <span className="ml-1" title="From the freezer">❄</span>}
      </span>
    </button>
  )
}

/** Batches cooked or eaten in the visible days, by cook date. */
function batchesInView(data: PlanData, days: IsoDate[]): Batch[] {
  const [first, last] = [days[0], days[days.length - 1]]
  return data.batches
    .filter((b) => {
      const f = data.forecasts.get(b.id)!
      const cooksInView = b.cookDate >= first && b.cookDate <= last
      const eatenInView = f.days.some((d) => d.date >= first && d.date <= last)
      return cooksInView || eatenInView
    })
    .sort((a, b) => a.cookDate.localeCompare(b.cookDate))
}

/** A short list above the grid, so problems are visible without scrolling past two weeks of meals. */
function Attention({ data, batches }: { data: PlanData; batches: Batch[] }) {
  const flagged = batches.flatMap((b) => {
    const problems = forecastProblems(data.forecasts.get(b.id)!)
    return problems.length ? [{ batch: b, problem: problems[0], more: problems.length - 1 }] : []
  })
  if (flagged.length === 0) return null
  return (
    <a href="#runway" className="block rounded-xl bg-red-50 p-3 text-sm ring-1 ring-red-200">
      <p className="font-semibold text-red-800">Needs attention</p>
      <ul className="mt-1 space-y-0.5 text-red-800">
        {flagged.map(({ batch, problem, more }) => (
          <li key={batch.id}>
            <span className="font-medium">{data.recipeById.get(batch.recipeId)?.title ?? 'Deleted recipe'}</span>: {problem}
            {more > 0 && ` (+${more} more)`}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-red-700">See the batches below the plan to fix it.</p>
    </a>
  )
}

function RunwayList({
  data,
  batches: inView,
  days,
  onUpdate,
}: {
  data: PlanData
  batches: Batch[]
  days: IsoDate[]
  onUpdate: (batchId: string, changes: Partial<Omit<Batch, 'id'>>) => void
}) {
  const first = days[0]
  return (
    <section id="runway" className="scroll-mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Batches these weeks</h2>
        <Link to={`/batches/new?cookDate=${nextCookDay(first)}&returnTo=/`} className="text-sm font-medium text-brand-700">
          + New batch
        </Link>
      </div>
      {inView.length === 0 ? (
        <p className="text-sm text-stone-500">
          No batches cooked or eaten in these weeks. Plan a batch, then tap a meal above to assign it.
        </p>
      ) : (
        inView.map((b) => (
          <BatchRunway key={b.id} batch={b} recipe={data.recipeById.get(b.recipeId)} forecast={data.forecasts.get(b.id)!} onUpdate={(c) => onUpdate(b.id, c)} />
        ))
      )}
    </section>
  )
}

/** The next Sunday from the view (or today, if that's later): the usual meal-prep day. */
function nextCookDay(viewStart: IsoDate): IsoDate {
  const from = viewStart > today() ? viewStart : today()
  const sunday = startOfWeek(from, 'sunday')
  return daysBetween(sunday, from) === 0 ? sunday : addDays(sunday, 7)
}
