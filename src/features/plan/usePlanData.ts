import { useMemo } from 'react'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { useBatches, useMealEntries } from '../../data/batches'
import { useRecipes } from '../../data/recipes'
import { addDays, today } from '../../domain/dates'
import { forecastBatch, type BatchForecast } from '../../domain/forecast'
import type { Batch, IsoDate, MealEntry, Recipe } from '../../domain/types'

/** How far back meal entries are loaded; older meals can't affect anything still in the fridge. */
const HISTORY_DAYS = 60

export interface PlanData {
  recipes: Recipe[]
  batches: Batch[]
  entries: MealEntry[]
  recipeById: Map<string, Recipe>
  batchById: Map<string, Batch>
  forecasts: Map<string, BatchForecast>
}

/** Recipes, batches, meal entries and every batch's forecast. `data` is null while loading. */
export function usePlanData(viewFrom?: IsoDate): { data: PlanData | null; error: string | null } {
  const { household } = useHouseholdContext()
  const historyStart = addDays(today(), -HISTORY_DAYS)
  const from = viewFrom && viewFrom < historyStart ? viewFrom : historyStart
  const { recipes, error: recipesError } = useRecipes(household.id)
  const { batches, error: batchesError } = useBatches(household.id)
  const { entries, error: entriesError } = useMealEntries(household.id, from)

  const data = useMemo(() => {
    if (!recipes || !batches || !entries) return null
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    const batchById = new Map(batches.map((b) => [b.id, b]))
    const forecasts = new Map(batches.map((b) => [b.id, forecastBatch(b, recipeById.get(b.recipeId), entries)]))
    return { recipes, batches, entries, recipeById, batchById, forecasts }
  }, [recipes, batches, entries])

  return { data, error: recipesError ?? batchesError ?? entriesError }
}
