import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { ExtraItem, TripState } from '../domain/types'
import { db } from './firebase'

function tripsRef(householdId: string) {
  return collection(db, 'households', householdId, 'trips')
}

/** What's been ticked off and added on each trip, live, by trip id. `trips` is null until loaded. */
export function useTripStates(householdId: string): { trips: Map<string, TripState> | null; error: string | null } {
  const [state, setState] = useState<{ trips: Map<string, TripState> | null; error: string | null }>({ trips: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        tripsRef(householdId),
        (snap) => {
          const trips = new Map<string, TripState>()
          for (const d of snap.docs) {
            const data = d.data() as Partial<TripState>
            trips.set(d.id, { id: d.id, checked: data.checked ?? {}, extras: data.extras ?? [] })
          }
          setState({ trips, error: null })
        },
        (e) => setState({ trips: null, error: e.message }),
      ),
    [householdId],
  )
  return state
}

// Merged writes touch only the one item, so both phones can tick things off at once (even offline)
// without overwriting each other.

export function setItemChecked(householdId: string, tripId: string, key: string, checked: boolean): Promise<void> {
  return setDoc(doc(tripsRef(householdId), tripId), { checked: { [key]: checked } }, { merge: true })
}

export function addExtra(householdId: string, tripId: string, name: string): Promise<void> {
  const extra: ExtraItem = { id: crypto.randomUUID(), name }
  return setDoc(doc(tripsRef(householdId), tripId), { extras: arrayUnion(extra) }, { merge: true })
}

export function removeExtra(householdId: string, tripId: string, extra: ExtraItem): Promise<void> {
  return setDoc(doc(tripsRef(householdId), tripId), { extras: arrayRemove(extra) }, { merge: true })
}
