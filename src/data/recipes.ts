import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { ParsedRecipe } from '../domain/recipemd/parse'
import type { Recipe } from '../domain/types'
import { db } from './firebase'

function recipesRef(householdId: string) {
  return collection(db, 'households', householdId, 'recipes')
}

export type RecipesState = { recipes: Recipe[] | null; error: string | null }

/** All recipes in the household, live, sorted by title. `recipes` is null until the first snapshot. */
export function useRecipes(householdId: string): RecipesState {
  const [state, setState] = useState<RecipesState>({ recipes: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        recipesRef(householdId),
        (snap) => {
          const recipes = snap.docs.map((d) => ({ ...(d.data() as ParsedRecipe), id: d.id }))
          recipes.sort((a, b) => a.title.localeCompare(b.title))
          setState({ recipes, error: null })
        },
        (e) => setState({ recipes: null, error: e.message }),
      ),
    [householdId],
  )
  return state
}

// Writes are not awaited by callers that navigate away: Firestore applies them to the local cache
// immediately (so the UI updates offline) and the promise only settles once the server confirms.

/** Create or replace a recipe. Returns its id straight away. */
export function saveRecipe(householdId: string, recipe: ParsedRecipe, id?: string): { id: string; done: Promise<void> } {
  const ref = id ? doc(recipesRef(householdId), id) : doc(recipesRef(householdId))
  return { id: ref.id, done: setDoc(ref, recipe) }
}

export function deleteRecipe(householdId: string, id: string): Promise<void> {
  return deleteDoc(doc(recipesRef(householdId), id))
}

export async function importRecipes(householdId: string, recipes: ParsedRecipe[]): Promise<void> {
  // Firestore batches hold up to 500 writes.
  for (let i = 0; i < recipes.length; i += 400) {
    const batch = writeBatch(db)
    for (const recipe of recipes.slice(i, i + 400)) batch.set(doc(recipesRef(householdId)), recipe)
    await batch.commit()
  }
}
