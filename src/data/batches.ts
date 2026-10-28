import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { EntryChanges } from '../domain/plan'
import type { Batch, IsoDate, MealEntry } from '../domain/types'
import { db } from './firebase'

function batchesRef(householdId: string) {
  return collection(db, 'households', householdId, 'batches')
}

function entriesRef(householdId: string) {
  return collection(db, 'households', householdId, 'mealEntries')
}

/** All batches in the household, live, newest cook date first. `batches` is null until loaded. */
export function useBatches(householdId: string): { batches: Batch[] | null; error: string | null } {
  const [state, setState] = useState<{ batches: Batch[] | null; error: string | null }>({ batches: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        batchesRef(householdId),
        (snap) => {
          const batches = snap.docs.map((d) => ({ ...(d.data() as Omit<Batch, 'id'>), id: d.id }))
          batches.sort((a, b) => b.cookDate.localeCompare(a.cookDate))
          setState({ batches, error: null })
        },
        (e) => setState({ batches: null, error: e.message }),
      ),
    [householdId],
  )
  return state
}

/** Meal entries on or after a date, live. `entries` is null until loaded. */
export function useMealEntries(householdId: string, from: IsoDate): { entries: MealEntry[] | null; error: string | null } {
  const [state, setState] = useState<{ entries: MealEntry[] | null; error: string | null }>({ entries: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        query(entriesRef(householdId), where('date', '>=', from)),
        (snap) => setState({ entries: snap.docs.map((d) => ({ ...(d.data() as Omit<MealEntry, 'id'>), id: d.id })), error: null }),
        (e) => setState({ entries: null, error: e.message }),
      ),
    [householdId, from],
  )
  return state
}

// As with recipes, callers don't wait on writes: Firestore applies them to the local cache straight
// away (so the plan updates offline) and the promises settle when the server confirms.

/** Create or replace a batch. Returns its id straight away. */
export function saveBatch(householdId: string, batch: Omit<Batch, 'id'>, id?: string): { id: string; done: Promise<void> } {
  const ref = id ? doc(batchesRef(householdId), id) : doc(batchesRef(householdId))
  return { id: ref.id, done: setDoc(ref, batch) }
}

export function updateBatch(householdId: string, id: string, changes: Partial<Omit<Batch, 'id'>>): Promise<void> {
  return updateDoc(doc(batchesRef(householdId), id), changes)
}

/** Delete a batch and every meal planned from it (including past ones not currently loaded). */
export async function deleteBatch(householdId: string, id: string): Promise<void> {
  const planned = await getDocs(query(entriesRef(householdId), where('batchId', '==', id)))
  const batch = writeBatch(db)
  for (const entry of planned.docs) batch.delete(entry.ref)
  batch.delete(doc(batchesRef(householdId), id))
  await batch.commit()
}

export function applyEntryChanges(householdId: string, changes: EntryChanges): Promise<void> {
  const batch = writeBatch(db)
  for (const { id, ...entry } of changes.set) batch.set(doc(entriesRef(householdId), id), entry)
  for (const id of changes.remove) batch.delete(doc(entriesRef(householdId), id))
  return batch.commit()
}
