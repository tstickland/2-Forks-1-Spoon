import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { WeekPattern, WeekTemplate } from '../domain/templates'
import { db } from './firebase'

function templatesRef(householdId: string) {
  return collection(db, 'households', householdId, 'templates')
}

/** Saved week templates, live, by name. `templates` is null until loaded. */
export function useTemplates(householdId: string): { templates: WeekTemplate[] | null; error: string | null } {
  const [state, setState] = useState<{ templates: WeekTemplate[] | null; error: string | null }>({ templates: null, error: null })
  useEffect(
    () =>
      onSnapshot(
        templatesRef(householdId),
        (snap) => {
          const templates = snap.docs.map((d) => ({ ...(d.data() as Omit<WeekTemplate, 'id'>), id: d.id }))
          templates.sort((a, b) => a.name.localeCompare(b.name))
          setState({ templates, error: null })
        },
        (e) => setState({ templates: null, error: e.message }),
      ),
    [householdId],
  )
  return state
}

export function saveTemplate(householdId: string, name: string, pattern: WeekPattern): Promise<void> {
  return setDoc(doc(templatesRef(householdId)), { name, ...pattern })
}

export function deleteTemplate(householdId: string, id: string): Promise<void> {
  return deleteDoc(doc(templatesRef(householdId), id))
}
