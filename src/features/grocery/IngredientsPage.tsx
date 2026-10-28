import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ingredientKey } from '../../domain/ingredients'
import { Badge, Card } from '../../ui/components'
import { IngredientSheet, type IngredientTarget } from './IngredientSheet'
import { useGroceryData } from './useGroceryData'

export function IngredientsPage() {
  const { data } = useGroceryData()
  const [editing, setEditing] = useState<IngredientTarget | null>(null)

  if (!data) return <p className="text-stone-500">Loading…</p>

  // Items on upcoming lists that haven't been set up, once each.
  const notSetUp = new Map<string, { key: string; name: string }>()
  for (const item of data.plan.trips.flatMap((t) => [...t.items, ...t.staples])) {
    if (!item.catalog) notSetUp.set(item.ingredientKey, { key: item.ingredientKey, name: item.name })
  }

  const byAisle = new Map<string, typeof data.catalog>()
  for (const c of data.catalog) byAisle.set(c.aisle || 'Other', [...(byAisle.get(c.aisle || 'Other') ?? []), c])

  return (
    <div className="space-y-4">
      <div>
        <Link to="/groceries" className="text-sm text-stone-500">
          ← Groceries
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Ingredients</h1>
        <p className="text-sm text-stone-600">
          Where you buy things, which aisle, how long they keep and what's a pantry staple. Shopping lists use these.
        </p>
      </div>

      {notSetUp.size > 0 && (
        <Card title={`Not set up yet (${notSetUp.size})`}>
          <p className="mb-2 text-sm text-stone-600">
            From your upcoming lists. Until set up, they go on the nearest trip before cooking, with a guessed aisle.
          </p>
          <ul className="divide-y divide-stone-100">
            {[...notSetUp.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((i) => (
                <li key={i.key} className="flex items-center justify-between py-2 text-sm">
                  <span>{i.name}</span>
                  <button className="font-medium text-brand-700" onClick={() => setEditing({ ingredientKey: i.key, name: i.name })}>
                    Set up
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {data.catalog.length === 0 && notSetUp.size === 0 && (
        <Card>
          <p className="text-stone-600">Nothing set up yet. Plan some batches and their ingredients will show up here.</p>
        </Card>
      )}

      {[...byAisle].sort(([a], [b]) => a.localeCompare(b)).map(([aisle, items]) => (
        <Card key={aisle} title={aisle}>
          <ul className="divide-y divide-stone-100">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
                  onClick={() => setEditing({ catalog: c, ingredientKey: ingredientKey(c.name), name: c.name })}
                >
                  <span>{c.name}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {c.store !== 'Either' && <Badge tone="brand">{c.store}</Badge>}
                    {c.pantryStaple && <Badge>Staple</Badge>}
                    {c.shelfLifeDays !== undefined && <Badge>Keeps {c.shelfLifeDays} d</Badge>}
                    {c.packSizeG !== undefined && <Badge>Pack {c.packSizeG} g</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {editing && <IngredientSheet target={editing} catalog={data.catalog} onClose={() => setEditing(null)} />}
    </div>
  )
}
