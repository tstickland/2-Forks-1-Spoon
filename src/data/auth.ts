import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
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

/** A message to show for a failed sign-in, or null when the person simply cancelled. */
export function signInErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string }).code
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/unauthorized-domain':
      return "This web address isn't allowed to sign in. Add it under Firebase → Authentication → Settings → Authorized domains."
    case 'auth/network-request-failed':
      return "Couldn't reach Google. Check your connection and try again."
    default:
      return `Sign-in failed: ${(e as Error).message ?? code ?? 'unknown error'}`
  }
}

/**
 * Errors from a redirect sign-in (used by the installed app) only surface on the page Google sends
 * you back to. Without this, a failed sign-in just shows the sign-in screen again with no reason.
 */
export function useRedirectSignInError(): string | null {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(signInErrorMessage(e)))
  }, [])
  return error
}

export function signOutUser(): Promise<void> {
  return signOut(auth)
}
