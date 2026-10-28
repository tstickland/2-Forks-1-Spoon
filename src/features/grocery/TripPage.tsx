import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { addExtra, removeExtra, setItemChecked } from '../../data/trips'
import { formatShort } from '../../domain/dates'
import type { GroceryItem } from '../../domain/grocery'
import type { ExtraItem } from '../../domain/types'
import { Button, Card, Input } from '../../ui/components'
import { IngredientSheet, type IngredientTarget } from './IngredientSheet'
import { PlanGapWarning } from './PlanGapWarning'
import { useGroceryData } from './useGroceryData'

export function TripPage() {
  const { tripId } = useParams()
  const { household } = useHouseholdContext()
  const { data } = useGroceryData()
  const [editing, setEditing] = useState<IngredientTarget | null>(null)
  const [extraName, setExtraName] = useState('')

  if (!data) return <p className="text-stone-500">Loading…</p>
  const list = data.plan.trips.find((t) => t.trip.id === tripId)
  if (!list || !tripId) {
    return (
      <Card title="Trip not found">
        <p className="mb-2 text-stone-600">It may be in the past or too far ahead.</p>
        <Link to="/groceries" className="text-brand-700">
          Back to groceries
        </Link>
      </Card>
    )
  }
  const state = data.tripStates.get(tripId)
  const checked = state?.checked ?? {}
  const extras = state?.extras ?? []
  const toggle = (key: string) => setItemChecked(household.id, tripId, key, !checked[key]).catch((e: Error) => alert(e.message))

  const submitExtra = (e: FormEvent) => {
    e.preventDefault()
    if (!extraName.trim()) return
    addExtra(household.id, tripId, extraName.trim()).catch((err: Error) => alert(err.message))
    setExtraName('')
  }

  const toBuy = list.items.filter((i) => !checked[i.key])
  const inCart = list.items.filter((i) => checked[i.key])
  const byAisle = new Map<string, GroceryItem[]>()
  for (const item of toBuy) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item])
  const total = list.items.length + extras.length
  const done = inCart.length + extras.filter((x) => checked[`x:${x.id}`]).length
  const setUp = (item: GroceryItem) => setEditing({ catalog: item.catalog, ingredientKey: item.ingredientKey, name: item.name })

  return (
    <div className="space-y-4">
      <div>
        <Link to="/groceries" className="text-sm text-stone-500">
          ← Groceries
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {list.trip.store} · {formatShort(list.trip.date)}
        </h1>
        <p className="text-sm text-stone-600">
          {total === 0 ? 'Nothing to buy yet.' : `${done} of ${total} in the cart`}
        </p>
      </div>

      {list.planGap && <PlanGapWarning gap={list.planGap} store={list.trip.store} />}

      <form onSubmit={submitExtra} className="flex gap-2">
        <Input placeholder="Add something else (e.g. paper towels)" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
        <Button type="submit" disabled={!extraName.trim()}>
          Add
        </Button>
      </form>

      {extras.length > 0 && (
        <Card title="Added by hand">
          <ul className="divide-y divide-stone-100">
            {extras.map((x) => (
              <ExtraRow
                key={x.id}
                extra={x}
                checked={Boolean(checked[`x:${x.id}`])}
                onToggle={() => toggle(`x:${x.id}`)}
                onRemove={() => removeExtra(household.id, tripId, x).catch((e: Error) => alert(e.message))}
              />
            ))}
          </ul>
        </Card>
      )}

      {[...byAisle].map(([aisle, items]) => (
        <Card key={aisle} title={aisle}>
          <ul className="divide-y divide-stone-100">
            {items.map((item) => (
              <ItemRow key={item.key} item={item} checked={false} onToggle={() => toggle(item.key)} onSetUp={() => setUp(item)} />
            ))}
          </ul>
        </Card>
      ))}

      {list.staples.length > 0 && (
        <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <summary className="cursor-pointer font-semibold">
            Check you have ({list.staples.length})
          </summary>
          <p className="mt-1 text-sm text-stone-500">Pantry staples these recipes use. Add any you're out of above.</p>
          <ul className="mt-2 divide-y divide-stone-100">
            {list.staples.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{item.name}</span>
                <span className="flex items-center gap-3 text-stone-500">
                  {item.quantity}
                  <button className="text-brand-700" onClick={() => setUp(item)}>
                    Edit
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {inCart.length > 0 && (
        <Card title="In the cart">
          <ul className="divide-y divide-stone-100">
            {inCart.map((item) => (
              <ItemRow key={item.key} item={item} checked onToggle={() => toggle(item.key)} onSetUp={() => setUp(item)} />
            ))}
          </ul>
        </Card>
      )}

      {editing && <IngredientSheet target={editing} catalog={data.catalog} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ItemRow({ item, checked, onToggle, onSetUp }: { item: GroceryItem; checked: boolean; onToggle: () => void; onSetUp: () => void }) {
  const uses = item.uses.map((u) => `${u.recipeTitle} (${formatShort(u.cookDate)})`).join(', ')
  return (
    <li className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        aria-label={item.name}
        className="mt-1 h-5 w-5 shrink-0 accent-brand-700"
        checked={checked}
        onChange={onToggle}
      />
      <div className={`min-w-0 flex-1 ${checked ? 'text-stone-400 line-through' : ''}`} onClick={onToggle}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{item.name}</span>
          <span className="shrink-0 text-right text-sm">{item.quantity}</span>
        </div>
        {!checked && <div className="text-xs text-stone-500">For {uses}</div>}
        {!checked && item.notes.map((n) => (
          <div key={n} className="text-xs text-amber-800">
            {n}
          </div>
        ))}
      </div>
      {!checked && (
        <button className={`shrink-0 text-xs ${item.catalog ? 'text-stone-400' : 'font-medium text-brand-700'}`} onClick={onSetUp}>
          {item.catalog ? 'Edit' : 'Set up'}
        </button>
      )}
    </li>
  )
}

function ExtraRow({ extra, checked, onToggle, onRemove }: { extra: ExtraItem; checked: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <input type="checkbox" aria-label={extra.name} className="h-5 w-5 shrink-0 accent-brand-700" checked={checked} onChange={onToggle} />
      <span className={`flex-1 ${checked ? 'text-stone-400 line-through' : ''}`} onClick={onToggle}>
        {extra.name}
      </span>
      <button className="text-stone-400" aria-label={`Remove ${extra.name}`} onClick={onRemove}>
        ×
      </button>
    </li>
  )
}
