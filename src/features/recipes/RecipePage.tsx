import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { deleteRecipe, useRecipes } from '../../data/recipes'
import { formatMacros, macrosPer100g } from '../../domain/macros'
import { toRecipeMd } from '../../domain/recipemd/serialize'
import type { Recipe } from '../../domain/types'
import { Badge, Button, Card } from '../../ui/components'

export function RecipePage() {
  const { id } = useParams()
  const { household } = useHouseholdContext()
  const { recipes } = useRecipes(household.id)
  const navigate = useNavigate()

  if (recipes === null) return <p className="text-stone-500">Loading…</p>
  const recipe = recipes.find((r) => r.id === id)
  if (!recipe) {
    return (
      <Card title="Recipe not found">
        <Link to="/recipes" className="text-brand-700">
          Back to recipes
        </Link>
      </Card>
    )
  }

  const remove = () => {
    if (!confirm(`Delete "${recipe.title}"? This can't be undone.`)) return
    deleteRecipe(household.id, recipe.id).catch((e: Error) => alert(e.message))
    navigate('/recipes')
  }

  return (
    <article className="space-y-4">
      <div>
        <Link to="/recipes" className="text-sm text-stone-500">
          ← Recipes
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{recipe.title}</h1>
        {recipe.description && <p className="mt-1 whitespace-pre-line text-stone-600">{recipe.description}</p>}
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </div>

      <Facts recipe={recipe} />

      <Card title="Ingredients">
        {recipe.ingredientGroups.length === 0 && <p className="text-stone-500">No ingredients.</p>}
        {recipe.ingredientGroups.map((g, i) => (
          <section key={i} className="mb-3 last:mb-0">
            {g.title && <h3 className="mb-1 text-sm font-semibold text-stone-700">{g.title}</h3>}
            <ul className="space-y-1">
              {g.ingredients.map((line, j) => (
                <li key={j}>
                  {line.amountText && <span className="mr-1.5 font-semibold text-stone-800">{line.amountText}</span>}
                  {line.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Card>

      {recipe.instructions && (
        <Card title="Instructions">
          <div className="markdown">
            <Markdown>{recipe.instructions}</Markdown>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to={`/recipes/${recipe.id}/edit`} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">
          Edit
        </Link>
        <Button variant="secondary" onClick={() => downloadRecipeMd(recipe)}>
          Download RecipeMD
        </Button>
        <Button variant="danger" onClick={remove}>
          Delete
        </Button>
      </div>
    </article>
  )
}

function Facts({ recipe }: { recipe: Recipe }) {
  const per100 = recipe.macrosTotal && recipe.expectedYieldG ? macrosPer100g(recipe.macrosTotal, recipe.expectedYieldG) : undefined
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-stone-200 sm:grid-cols-4">
      <Fact label="Cooked weight (1×)">
        {recipe.expectedYieldG ? `${recipe.expectedYieldG} g` : <span className="text-amber-700">Not set</span>}
      </Fact>
      <Fact label="Keeps in fridge">{recipe.fridgeDays} days</Fact>
      <Fact label="Whole recipe">
        {recipe.macrosTotal ? formatMacros(recipe.macrosTotal) : <span className="text-amber-700">No macros</span>}
      </Fact>
      <Fact label="Per 100 g">{per100 ? formatMacros(per100) : '—'}</Fact>
      {recipe.yieldsText && <Fact label="Yields (as written)">{recipe.yieldsText}</Fact>}
    </dl>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function downloadRecipeMd(recipe: Recipe) {
  const { id: _id, ...data } = recipe
  const blob = new Blob([toRecipeMd(data)], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${recipe.title.replace(/[\\/:*?"<>|]/g, '')}.md`
  a.click()
  URL.revokeObjectURL(url)
}
