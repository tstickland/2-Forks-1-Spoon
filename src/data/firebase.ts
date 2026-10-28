import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const env = import.meta.env

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY)

export const usingEmulators = env.VITE_USE_EMULATORS === 'true'

// The emulators run the "demo-" project (see package.json). Always use it in emulator mode so a
// real config in .env.local can't point local testing at the live project.
const projectId = usingEmulators ? 'demo-2-forks-1-spoon' : env.VITE_FIREBASE_PROJECT_ID || 'demo-2-forks-1-spoon'

const app = initializeApp({
  apiKey: (!usingEmulators && env.VITE_FIREBASE_API_KEY) || 'demo-key',
  authDomain: (!usingEmulators && env.VITE_FIREBASE_AUTH_DOMAIN) || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// The persistent cache keeps the whole household's data in IndexedDB, so the app opens and
// accepts edits offline (e.g. ticking off groceries in Costco) and syncs when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  // Optional fields are left undefined in the domain model; just omit them when writing.
  ignoreUndefinedProperties: true,
})

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
// Always show Google's account chooser. Without this Google silently reuses whichever account the
// browser is signed into (e.g. a school account), with no chance to pick another.
googleProvider.setCustomParameters({ prompt: 'select_account' })

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
