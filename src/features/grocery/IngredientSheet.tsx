import { useState, type FormEvent } from 'react'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { deleteCatalogItem, saveCatalogItem } from '../../data/catalog'
import { guessAisle, guessStaple, ingredientKey } from '../../domain/ingredients'
import type { CatalogIngredient, Store } from '../../domain/types'
import { Button, Field, Input, Sheet } from '../../ui/components'

const STORES: Store[] = ['Costco', 'Grocery', 'Either']
const AISLES = ['Produce', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Frozen', 'Pantry', 'Spices', 'Sauces & oils', 'Drinks', 'Other']
const CONVERSION_UNITS = ['cup', 'tbsp', 'tsp', 'each', 'can', 'clove', 'head', 'slice', 'pack', 'jar', 'bunch', 'piece']

export interface IngredientTarget {
  /** Existing catalog entry to edit; absent to set up a new one. */
  catalog?: CatalogIngredient
  /** Normalised name from the recipes (for a new entry, and to link to an existing one). */
  ingredientKey: string
  name: string
}

export function IngredientSheet({ target, catalog, onClose }: { target: IngredientTarget; catalog: CatalogIngredient[]; onClose: () => void }) {
  const { household } = useHouseholdContext()
  const existing = target.catalog
  const [name, setName] = useState(existing?.name ?? target.name)
  const [store, setStore] = useState<Store>(existing?.store ?? 'Either')
  const [aisle, setAisle] = useState(existing?.aisle || guessAisle(target.ingredientKey))
  const [shelfLife, setShelfLife] = useState(existing?.shelfLifeDays !== undefined ? String(existing.shelfLifeDays) : '')
  const [staple, setStaple] = useState(existing?.pantryStaple ?? guessStaple(target.ingredientKey))
  const [packSize, setPackSize] = useState(existing?.packSizeG !== undefined ? String(existing.packSizeG) : '')
  const [conversions, setConversions] = useState<{ unit: string; grams: string }[]>(
    Object.entries(existing?.gramsPerUnit ?? {}).map(([unit, grams]) => ({ unit, grams: String(grams) })),
  )
  const [linkTo, setLinkTo] = useState('')

  const others = catalog.filter((c) => c.id !== existing?.id)
  const shelfValue = shelfLife.trim() === '' ? undefined : Number(shelfLife)
  const packValue = packSize.trim() === '' ? undefined : Number(packSize)
  const valid =
    name.trim() !== '' &&
    (shelfValue === undefined || (Number.isInteger(shelfValue) && shelfValue >= 0)) &&
    (packValue === undefined || packValue > 0) &&
    conversions.every((c) => c.unit && Number(c.grams) > 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (linkTo) {
      // "Same as" an existing ingredient: remember this name as one of its aliases.
      const other = others.find((c) => c.id === linkTo)!
      const aliases = [...new Set([...other.aliases, target.ingredientKey])]
      const { id, ...rest } = other
      saveCatalogItem(household.id, { ...rest, aliases }, id).done.catch((err: Error) => alert(err.message))
      onClose()
      return
    }
    if (!valid) return
    const aliases = new Set(existing?.aliases ?? [])
    if (ingredientKey(name) !== target.ingredientKey) aliases.add(target.ingredientKey)
    const item: Omit<CatalogIngredient, 'id'> = {
      name: name.trim(),
      aliases: [...aliases],
      store,
      aisle: aisle.trim(),
      pantryStaple: staple,
      gramsPerUnit: Object.fromEntries(conversions.map((c) => [c.unit, Number(c.grams)])),
      shelfLifeDays: shelfValue,
      packSizeG: packValue,
    }
    saveCatalogItem(household.id, item, existing?.id).done.catch((err: Error) => alert(err.message))
    onClose()
  }

  const remove = () => {
    if (!existing || !confirm(`Remove ${existing.name} from your ingredients? Recipes keep it; it just loses these settings.`)) return
    deleteCatalogItem(household.id, existing.id).catch((err: Error) => alert(err.message))
    onClose()
  }

  return (
    <Sheet title={existing ? `Edit ${existing.name}` : `Set up ${target.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!existing && others.length > 0 && (
          <Field label="Same as an ingredient you've set up?">
            <select
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base"
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
            >
              <option value="">No, it's its own thing</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!linkTo && (
          <>
            <Field label="Name on the list">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Where you buy it</span>
              <div className="mt-1 flex gap-2">
                {STORES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStore(s)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm ring-1 ${
                      store === s ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-stone-300'
                    }`}
                  >
                    {s === 'Either' ? 'Either' : s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Aisle">
                <Input list="aisles" value={aisle} onChange={(e) => setAisle(e.target.value)} />
                <datalist id="aisles">
                  {AISLES.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
              <Field label="Keeps for (days)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Doesn't spoil"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-stone-500">
              Days from buying to cooking. Short-lived items get bought on a trip closer to the cook day.
            </p>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={staple} onChange={(e) => setStaple(e.target.checked)} />
              <span>Pantry staple: usually in the cupboard, so list it under "check you have" instead of "buy".</span>
            </label>

            <Field label="Pack size (g, optional)">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="e.g. 2700 for a Costco chicken pack"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
              />
            </Field>

            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Conversions to grams (optional)</span>
              <p className="text-xs text-stone-500">Lets cups, cans or "3 eggs" add up with grams on the list.</p>
              <div className="mt-1 space-y-2">
                {conversions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>1</span>
                    <select
                      className="rounded-lg border border-stone-300 bg-white px-2 py-2"
                      value={c.unit}
                      onChange={(e) => setConversions(conversions.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
                    >
                      {CONVERSION_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <span>=</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      className="!w-24"
                      aria-label={`Grams per ${c.unit}`}
                      value={c.grams}
                      onChange={(e) => setConversions(conversions.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                    />
                    <span>g</span>
                    <button
                      type="button"
                      className="ml-auto text-stone-400"
                      aria-label="Remove conversion"
                      onClick={() => setConversions(conversions.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-brand-700"
                onClick={() => setConversions([...conversions, { unit: CONVERSION_UNITS.find((u) => !conversions.some((c) => c.unit === u)) ?? 'cup', grams: '' }])}
              >
                + Add conversion
              </button>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {existing ? (
            <Button type="button" variant="danger" onClick={remove}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!linkTo && !valid}>
            {linkTo ? 'Link' : 'Save'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
