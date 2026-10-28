import { useState } from 'react'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { addBatchesAndEntries, applyEntryChanges, newBatchId } from '../../data/batches'
import { deleteTemplate, saveTemplate, useTemplates } from '../../data/templates'
import { addDays, formatShort } from '../../domain/dates'
import { captureWeek, describePattern, instantiateWeek, type WeekPattern } from '../../domain/templates'
import type { IsoDate } from '../../domain/types'
import { Button, Input, Sheet } from '../../ui/components'
import type { PlanData } from './usePlanData'

export function WeekSheet({ data, weekStart, onClose }: { data: PlanData; weekStart: IsoDate; onClose: () => void }) {
  const { household } = useHouseholdContext()
  const { templates } = useTemplates(household.id)
  const [name, setName] = useState('')

  const weekEnd = addDays(weekStart, 6)
  const thisWeek = captureWeek(weekStart, data.batches, data.entries)
  const lastWeek = captureWeek(addDays(weekStart, -7), data.batches, data.entries)
  const mealsThisWeek = data.entries.filter((e) => e.date >= weekStart && e.date <= weekEnd)

  const apply = (pattern: WeekPattern) => {
    const { batches, entries } = instantiateWeek(pattern, weekStart, household, () => newBatchId(household.id))
    addBatchesAndEntries(household.id, batches, entries).catch((e: Error) => alert(`Couldn't add the week: ${e.message}`))
    onClose()
  }

  const saveAsTemplate = () => {
    saveTemplate(household.id, name.trim(), thisWeek).catch((e: Error) => alert(`Couldn't save the template: ${e.message}`))
    onClose()
  }

  const clearWeek = () => {
    if (!confirm(`Remove all ${mealsThisWeek.length} planned meals in the week of ${formatShort(weekStart)}? Batches are kept.`)) return
    applyEntryChanges(household.id, { set: [], remove: mealsThisWeek.map((e) => e.id) }).catch((e: Error) => alert(e.message))
    onClose()
  }

  const replaceNote = mealsThisWeek.length > 0 && (
    <p className="mt-1 text-xs text-stone-500">Meals already planned in the same slots this week will be replaced.</p>
  )

  return (
    <Sheet title={`Week of ${formatShort(weekStart)}`} onClose={onClose}>
      <div className="space-y-5">
        <section>
          <h3 className="text-sm font-semibold">Repeat the week before</h3>
          <p className="text-sm text-stone-600">
            New batches of the same recipes and scales, cooked a week later, with the same meals and portions.
          </p>
          <Button className="mt-2" disabled={lastWeek.meals.length === 0 && lastWeek.batches.length === 0} onClick={() => apply(lastWeek)}>
            {lastWeek.batches.length ? `Repeat (${describePattern(lastWeek)})` : 'Nothing planned the week before'}
          </Button>
          {replaceNote}
        </section>

        <section>
          <h3 className="text-sm font-semibold">Templates</h3>
          {templates && templates.length > 0 ? (
            <ul className="mt-1 divide-y divide-stone-100">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-stone-500">{describePattern(t)}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button className="!px-3 !py-1" onClick={() => apply(t)}>
                      Apply
                    </Button>
                    <button
                      className="text-stone-400"
                      aria-label={`Delete template ${t.name}`}
                      onClick={() => confirm(`Delete the template "${t.name}"?`) && deleteTemplate(household.id, t.id).catch((e: Error) => alert(e.message))}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">No templates yet. Save a week you'd like to reuse.</p>
          )}
          {templates && templates.length > 0 && replaceNote}
          <div className="mt-2 flex gap-2">
            <Input placeholder="Name this week, e.g. Usual week A" value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="secondary" disabled={!name.trim() || thisWeek.batches.length === 0} onClick={saveAsTemplate}>
              Save
            </Button>
          </div>
          {thisWeek.batches.length === 0 && <p className="mt-1 text-xs text-stone-500">Plan something this week to save it.</p>}
        </section>

        {mealsThisWeek.length > 0 && (
          <section>
            <Button variant="danger" onClick={clearWeek}>
              Clear this week's meals
            </Button>
          </section>
        )}
      </div>
    </Sheet>
  )
}
