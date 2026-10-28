import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { importRecipes, useRecipes } from '../../data/recipes'
import { categoryFromPath, looksLikeRecipe, parseRecipeMd, type ParseResult } from '../../domain/recipemd/parse'
import { Badge, Button, Card, PageHeader } from '../../ui/components'

interface Candidate extends ParseResult {
  path: string
  selected: boolean
  duplicate: boolean
}

/** Vault-relative path. A folder pick includes the chosen folder's own name first; drop it. */
function vaultPath(file: File): string {
  const rel = file.webkitRelativePath
  return rel ? rel.split('/').slice(1).join('/') : file.name
}

function isHidden(path: string): boolean {
  return path.split('/').some((part) => part.startsWith('.'))
}

function isTemplate(path: string): boolean {
  return path.split('/').some((part) => /^templates?$/i.test(part))
}

export function RecipeImportPage() {
  const { household } = useHouseholdContext()
  const { recipes } = useRecipes(household.id)
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existingTitles = new Set((recipes ?? []).map((r) => r.title.toLowerCase()))

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    const found: Candidate[] = []
    const notRecipes: string[] = []
    for (const file of files) {
      const path = vaultPath(file)
      if (!path.toLowerCase().endsWith('.md') || isHidden(path)) continue
      const text = await file.text()
      if (!looksLikeRecipe(text)) {
        notRecipes.push(path)
        continue
      }
      const result = parseRecipeMd(text, { path })
      const duplicate = existingTitles.has(result.recipe.title.toLowerCase())
      found.push({ ...result, path, duplicate, selected: !duplicate && !isTemplate(path) })
    }
    found.sort((a, b) => a.path.localeCompare(b.path))
    setCandidates(found)
    setSkipped(notRecipes.sort())
  }

  const toggle = (path: string) =>
    setCandidates((cs) => cs?.map((c) => (c.path === path ? { ...c, selected: !c.selected } : c)) ?? null)
  const setAll = (selected: boolean) => setCandidates((cs) => cs?.map((c) => ({ ...c, selected })) ?? null)

  const chosen = candidates?.filter((c) => c.selected) ?? []

  const runImport = () => {
    setBusy(true)
    setError(null)
    importRecipes(
      household.id,
      chosen.map((c) => c.recipe),
    )
      .then(() => navigate('/recipes'))
      .catch((e: Error) => {
        setError(e.message)
        setBusy(false)
      })
  }

  // Group the preview by folder ("Dinner", "Lunch", …).
  const byFolder = new Map<string, Candidate[]>()
  for (const c of candidates ?? []) {
    const folder = categoryFromPath(c.path) ?? 'Vault root'
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), c])
  }

  return (
    <>
      <PageHeader title="Import recipes">
        <Link to="/recipes" className="text-sm text-stone-600">
          Cancel
        </Link>
      </PageHeader>

      <div className="space-y-4">
        <Card title="Choose your recipes">
          <p className="mb-3 text-sm text-stone-600">
            Pick your Obsidian vault folder (on a computer) or select the recipe <code>.md</code> files (works on phones
            too). Nothing is saved until you press Import.
          </p>
          <div className="flex flex-wrap gap-2">
            <FilePicker label="Choose vault folder" directory onChange={onFiles} />
            <FilePicker label="Choose .md files" onChange={onFiles} />
          </div>
        </Card>

        {candidates && (
          <Card
            title={`Found ${candidates.length} recipe${candidates.length === 1 ? '' : 's'}`}
            action={
              <div className="flex gap-3 text-sm">
                <button className="text-brand-700" onClick={() => setAll(true)}>
                  All
                </button>
                <button className="text-brand-700" onClick={() => setAll(false)}>
                  None
                </button>
              </div>
            }
          >
            {[...byFolder].map(([folder, items]) => (
              <section key={folder} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{folder}</h3>
                <ul className="divide-y divide-stone-100">
                  {items.map((c) => (
                    <CandidateRow key={c.path} candidate={c} onToggle={() => toggle(c.path)} />
                  ))}
                </ul>
              </section>
            ))}
            {skipped.length > 0 && (
              <details className="mt-4 text-sm text-stone-500">
                <summary>
                  Skipped {skipped.length} file{skipped.length === 1 ? '' : 's'} that {skipped.length === 1 ? "isn't a recipe" : "aren't recipes"}
                </summary>
                <ul className="mt-1 list-disc pl-5">
                  {skipped.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        )}

        {candidates && (
          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-stone-200 bg-stone-50/95 px-4 py-3">
            {error && <span className="text-sm text-red-700">{error}</span>}
            <Button disabled={busy || chosen.length === 0} onClick={runImport}>
              {busy ? 'Importing…' : `Import ${chosen.length} recipe${chosen.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function FilePicker({
  label,
  directory,
  onChange,
}: {
  label: string
  directory?: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  // webkitdirectory isn't in React's types; it's supported by desktop Chrome, Edge, Firefox and Safari.
  const dirProps = directory ? { webkitdirectory: '', directory: '' } : {}
  return (
    <label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-medium ring-1 ring-stone-300 hover:bg-stone-100">
      {label}
      <input type="file" multiple accept=".md,text/markdown" className="sr-only" onChange={onChange} {...dirProps} />
    </label>
  )
}

function CandidateRow({ candidate: c, onToggle }: { candidate: Candidate; onToggle: () => void }) {
  const ingredientCount = c.recipe.ingredientGroups.reduce((n, g) => n + g.ingredients.length, 0)
  return (
    <li className="py-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={c.selected} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{c.recipe.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-xs">
            <Badge>{ingredientCount} ingredients</Badge>
            {c.recipe.expectedYieldG ? (
              <Badge tone="brand">{c.recipe.expectedYieldG} g yield</Badge>
            ) : (
              <Badge tone="warning">No yield weight</Badge>
            )}
            {c.duplicate && <Badge tone="warning">Already imported</Badge>}
            {isTemplate(c.path) && <Badge>Template</Badge>}
          </div>
          {c.warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
              {c.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      </label>
    </li>
  )
}
