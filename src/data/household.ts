import type { User } from 'firebase/auth'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { joinChanges, newHousehold, type NewMember } from '../domain/household'
import type { Household } from '../domain/types'
import { db } from './firebase'

const households = collection(db, 'households')

function toNewMember(user: User): NewMember {
  return { uid: user.uid, name: user.displayName || user.email || 'Me', email: user.email ?? '' }
}

export type HouseholdState =
  | { status: 'loading' }
  | { status: 'member'; household: Household }
  | { status: 'none'; invites: Household[] }
  | { status: 'error'; message: string }

/** The signed-in user's household, or the households they've been invited to if they have none. */
export function useHousehold(user: User): HouseholdState {
  const [mine, setMine] = useState<Household[] | null>(null)
  const [invites, setInvites] = useState<Household[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const unsubMine = onSnapshot(
      query(households, where('memberUids', 'array-contains', user.uid)),
      (snap) => setMine(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Household)),
      onError,
    )
    const email = user.email?.toLowerCase()
    const unsubInvites = email
      ? onSnapshot(
          query(households, where('invitedEmails', 'array-contains', email)),
          (snap) => setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Household)),
          onError,
        )
      : () => {}
    return () => {
      unsubMine()
      unsubInvites()
    }
  }, [user.uid, user.email])

  // Without an email there is nothing to be invited by.
  const pendingInvites = user.email ? invites : []

  if (error) return { status: 'error', message: error }
  if (mine === null) return { status: 'loading' }
  if (mine.length > 0) return { status: 'member', household: mine[0] }
  if (pendingInvites === null) return { status: 'loading' }
  return { status: 'none', invites: pendingInvites.filter((h) => !h.memberUids.includes(user.uid)) }
}

export async function createHousehold(user: User): Promise<void> {
  await addDoc(households, newHousehold(toNewMember(user)))
}

export async function joinHousehold(user: User, householdId: string): Promise<void> {
  const ref = doc(households, householdId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('That household no longer exists.')
    tx.update(ref, joinChanges({ id: snap.id, ...snap.data() } as Household, toNewMember(user)))
  })
}

export function inviteEmail(householdId: string, email: string): Promise<void> {
  return updateDoc(doc(households, householdId), { invitedEmails: arrayUnion(email.trim().toLowerCase()) })
}

export function revokeInvite(householdId: string, email: string): Promise<void> {
  return updateDoc(doc(households, householdId), { invitedEmails: arrayRemove(email) })
}

export function updateHousehold(householdId: string, changes: Partial<Omit<Household, 'id'>>): Promise<void> {
  return updateDoc(doc(households, householdId), changes)
}
