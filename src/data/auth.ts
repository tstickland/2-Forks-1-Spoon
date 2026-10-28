import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth, googleProvider } from './firebase'

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: auth.currentUser,
    loading: true,
  })
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), [])
  return state
}

/** True when running as an installed app (home-screen icon) rather than in a browser tab. */
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

export async function signInWithGoogle(): Promise<void> {
  // Popups are unreliable inside installed apps (especially on iOS), so use a full redirect there.
  if (isStandalone()) return signInWithRedirect(auth, googleProvider)
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, googleProvider)
    }
    throw e
  }
}

export function signOutUser(): Promise<void> {
  return signOut(auth)
}
