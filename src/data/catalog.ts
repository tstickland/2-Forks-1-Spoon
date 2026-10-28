import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { CatalogIngredient } from '../domain/types'
import { db } from './firebase'

function catalogRef(householdId: string) {
  return collection(db, 'households', householdId, 'ingredients')
}

/** The household's ingredient catalog, live, by name. `catalog` is null until loaded. */
export function useCatalog(householdId: string): { catalog: CatalogIngredient[] | null; error: string | null } {
  const [state, setState] = useState<{ catalog: CatalogIngredient[] | null; error: string | null }>({ catalog: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        catalogRef(householdId),
        (snap) => {
          const catalog = snap.docs.map((d) => ({ ...(d.data() as Omit<CatalogIngredient, 'id'>), id: d.id }))
          catalog.sort((a, b) => a.name.localeCompare(b.name))
          setState({ catalog, error: null })
        },
        (e) => setState({ catalog: null, error: e.message }),
      ),
    [householdId],
  )
  return state
}

/** Create or replace a catalog item. Not awaited by callers (see batches.ts). */
export function saveCatalogItem(householdId: string, item: Omit<CatalogIngredient, 'id'>, id?: string): { id: string; done: Promise<void> } {
  const ref = id ? doc(catalogRef(householdId), id) : doc(catalogRef(householdId))
  return { id: ref.id, done: setDoc(ref, item) }
}

export function deleteCatalogItem(householdId: string, id: string): Promise<void> {
  return deleteDoc(doc(catalogRef(householdId), id))
}
