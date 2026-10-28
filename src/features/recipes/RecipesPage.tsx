import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { useRecipes } from '../../data/recipes'
import type { Recipe } from '../../domain/types'
import { Badge, Card, Input, PageHeader } from '../../ui/components'

export function RecipesPage() {
  const { household } = useHouseholdContext()
  const { recipes, error } = useRecipes(household.id)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => tagsByUse(recipes ?? []), [recipes])
  const shown = (recipes ?? []).filter(
    (r) =>
      (!tag || r.tags.includes(tag)) &&
      (!search || `${r.title} ${r.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <>
      <PageHeader title="Recipes">
        <div className="flex gap-2">
          <Link to="/recipes/import" className="rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-stone-300 bg-white">
            Import
          </Link>
          <Link to="/recipes/new" className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">
            New
          </Link>
        </div>
      </PageHeader>

      {error && <p className="mb-3 text-sm text-red-700">Couldn't load recipes: {error}</p>}
      {recipes === null && !error && <p className="text-stone-500">Loading…</p>}

      {recipes?.length === 0 && (
        <Card title="No recipes yet">
          <p className="mb-3 text-stone-600">
            Bring your recipes over from Obsidian, or add one by hand.
          </p>
          <Link to="/recipes/import" className="inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">
            Import from Obsidian
          </Link>
        </Card>
      )}

      {recipes && recipes.length > 0 && (
        <div className="space-y-3">
          <Input type="search" placeholder="Search recipes" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ring-1 ${
                  tag === t ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-stone-700 ring-stone-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
            {shown.map((r) => (
              <li key={r.id}>
                <RecipeRow recipe={r} />
              </li>
            ))}
            {shown.length === 0 && <li className="p-4 text-stone-500">No recipes match.</li>}
          </ul>
        </div>
      )}
    </>
  )
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="block px-4 py-3 hover:bg-stone-50">
      <div className="font-medium">{recipe.title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {!recipe.expectedYieldG && <Badge tone="warning">No yield weight</Badge>}
        {!recipe.macrosTotal && <Badge tone="warning">No macros</Badge>}
        {recipe.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
    </Link>
  )
}

/** Tags ordered by how many recipes use them, most used first. */
function tagsByUse(recipes: Recipe[]): string[] {
  const counts = new Map<string, number>()
  for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
}
