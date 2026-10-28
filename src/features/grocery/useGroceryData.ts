import { useMemo } from 'react'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { useCatalog } from '../../data/catalog'
import { useTripStates } from '../../data/trips'
import { today } from '../../domain/dates'
import { buildGroceryPlan, lastPlannedDate, type GroceryPlan } from '../../domain/grocery'
import type { CatalogIngredient, TripState } from '../../domain/types'
import { usePlanData } from '../plan/usePlanData'

export interface GroceryData {
  plan: GroceryPlan
  catalog: CatalogIngredient[]
  tripStates: Map<string, TripState>
}

/** The generated shopping lists plus what's been ticked off. `data` is null while loading. */
export function useGroceryData(): { data: GroceryData | null; error: string | null } {
  const { household } = useHouseholdContext()
  const { data: planData, error: planError } = usePlanData()
  const { catalog, error: catalogError } = useCatalog(household.id)
  const { trips: tripStates, error: tripsError } = useTripStates(household.id)

  const data = useMemo(() => {
    if (!planData || !catalog || !tripStates) return null
    const plan = buildGroceryPlan({
      batches: planData.batches,
      recipeById: planData.recipeById,
      catalog,
      schedule: household.schedule,
      today: today(),
      plannedUntil: lastPlannedDate(planData.batches, planData.entries),
    })
    return { plan, catalog, tripStates }
  }, [planData, catalog, tripStates, household.schedule])

  return { data, error: planError ?? catalogError ?? tripsError }
}
