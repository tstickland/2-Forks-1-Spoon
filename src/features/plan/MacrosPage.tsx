import { Link, useSearchParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { addDays, dateRange, dayOfMonth, formatShort, startOfWeek, today, weekdayShort } from '../../domain/dates'
import { dailyMacros, formatMacros, MACRO_KEYS, type DayMacros } from '../../domain/macros'
import type { Macros, Member } from '../../domain/types'
import { Button, Card } from '../../ui/components'
import { usePlanData } from './usePlanData'

const LABELS: Record<keyof Macros, string> = { kcal: 'kcal', protein: 'P', carbs: 'C', fat: 'F' }

export function MacrosPage() {
  const { household } = useHouseholdContext()
  const [params, setParams] = useSearchParams()
  const weekStart = startOfWeek(params.get('week') ?? today(), 'sunday')
  const { data } = usePlanData(weekStart)
  const days = dateRange(weekStart, addDays(weekStart, 6))
  const goTo = (week: string) => setParams({ week }, { replace: true })

  const anyMacros = data?.recipes.some((r) => r.macrosTotal)

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-stone-500">
          ← Plan
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Macros</h1>
          <div className="flex gap-1">
            <Button variant="secondary" className="!px-3" aria-label="Previous week" onClick={() => goTo(addDays(weekStart, -7))}>
              ‹
            </Button>
            <Button variant="secondary" className="!px-3" aria-label="Next week" onClick={() => goTo(addDays(weekStart, 7))}>
              ›
            </Button>
          </div>
        </div>
        <p className="text-sm text-stone-600">
          Week of {formatShort(weekStart)}, from planned lunches and dinners. What's left under each target is room for
          breakfast and snacks.
        </p>
      </div>

      {!data && <p className="text-stone-500">Loading…</p>}
      {data && !anyMacros && (
        <Card title="No recipe macros yet">
          <p className="text-sm text-stone-600">
            Add macros to your recipes (Recipes → a recipe → Edit → "Macros for the whole recipe") and they'll add up here
            per person, using each batch's cooked weight.
          </p>
        </Card>
      )}
      {data &&
        household.members.map((m) => (
          <PersonWeek key={m.uid} member={m} days={dailyMacros(m.uid, days, data.entries, data.batchById, data.recipeById)} />
        ))}
    </div>
  )
}

function PersonWeek({ member, days }: { member: Member; days: DayMacros[] }) {
  const target = member.macroTargets
  const planned = days.filter((d) => d.meals > 0)
  const missing = days.some((d) => d.unknownG > 0)
  return (
    <Card title={member.name}>
      <p className="-mt-2 mb-3 text-xs text-stone-500">Daily target: {formatMacros(target)}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-stone-500">
            <th className="pb-1 text-left font-medium">Day</th>
            {MACRO_KEYS.map((k) => (
              <th key={k} className="pb-1 text-right font-medium">
                {LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {days.map((d) => (
            <tr key={d.date} className={d.date === today() ? 'bg-brand-50' : ''}>
              <td className="py-1.5 pr-2 whitespace-nowrap">
                {weekdayShort(d.date)} {dayOfMonth(d.date)}
                {d.unknownG > 0 && <span className="text-amber-700">*</span>}
              </td>
              {MACRO_KEYS.map((k) => (
                <td key={k} className="py-1.5 text-right tabular-nums">
                  {d.meals === 0 ? <span className="text-stone-300">—</span> : <MacroCell value={d.macros[k]} target={target[k]} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {planned.length > 0 && (
        <p className="mt-2 text-xs text-stone-500">
          Average on planned days: {formatMacros(average(planned))}
        </p>
      )}
      {missing && (
        <p className="mt-1 text-xs text-amber-800">
          * Includes meals from recipes without macros (or without a cooked weight), so the real total is higher.
        </p>
      )}
    </Card>
  )
}

/** The planned amount, with what's left of the target underneath (or how far over it is). */
function MacroCell({ value, target }: { value: number; target: number }) {
  const left = target - value
  return (
    <div className="leading-tight">
      <div>{Math.round(value)}</div>
      {target > 0 && (
        <div className={`text-[11px] ${left < 0 ? 'text-red-700' : 'text-stone-400'}`}>
          {left < 0 ? `+${Math.round(-left)}` : `${Math.round(left)} left`}
        </div>
      )}
    </div>
  )
}

function average(days: DayMacros[]): Macros {
  const sum = (k: keyof Macros) => days.reduce((s, d) => s + d.macros[k], 0) / days.length
  return { kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') }
}
