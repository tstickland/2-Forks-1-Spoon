import type { User } from 'firebase/auth'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { signInErrorMessage, signInWithGoogle, signOutUser, useAuthUser, useRedirectSignInError } from '../data/auth'
import { firebaseConfigured, usingEmulators } from '../data/firebase'
import { createHousehold, joinHousehold, useHousehold } from '../data/household'
import { BatchesPage } from '../features/batches/BatchesPage'
import { BatchPage } from '../features/batches/BatchPage'
import { NewBatchPage } from '../features/batches/NewBatchPage'
import { GroceryPage } from '../features/grocery/GroceryPage'
import { PlanPage } from '../features/plan/PlanPage'
import { RecipeEditorPage } from '../features/recipes/RecipeEditorPage'
import { RecipeImportPage } from '../features/recipes/RecipeImportPage'
import { RecipePage } from '../features/recipes/RecipePage'
import { RecipesPage } from '../features/recipes/RecipesPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { Button, Card, CenteredMessage } from '../ui/components'
import { HouseholdProvider } from './HouseholdContext'
import { Layout } from './Layout'

export default function App() {
  if (!firebaseConfigured && !usingEmulators) return <SetupNeeded />
  return <AuthGate />
}

function AuthGate() {
  const { user, loading } = useAuthUser()
  if (loading) return <CenteredMessage>Loading…</CenteredMessage>
  if (!user) return <SignIn />
  return <HouseholdGate user={user} />
}

function HouseholdGate({ user }: { user: User }) {
  const state = useHousehold(user)
  switch (state.status) {
    case 'loading':
      return <CenteredMessage>Loading your household…</CenteredMessage>
    case 'error':
      return (
        <CenteredMessage>
          <div className="max-w-sm space-y-4">
            <p>Couldn't load your household: {state.message}</p>
            <SwitchAccount user={user} />
          </div>
        </CenteredMessage>
      )
    case 'none':
      return <Onboarding user={user} invites={state.invites} />
    case 'member':
      return (
        <HouseholdProvider user={user} household={state.household}>
          <Layout>
            <Routes>
              <Route path="/" element={<PlanPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/batches/new" element={<NewBatchPage />} />
              <Route path="/batches/:id" element={<BatchPage />} />
              <Route path="/groceries" element={<GroceryPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/recipes/import" element={<RecipeImportPage />} />
              <Route path="/recipes/new" element={<RecipeEditorPage />} />
              <Route path="/recipes/:id" element={<RecipePage />} />
              <Route path="/recipes/:id/edit" element={<RecipeEditorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </HouseholdProvider>
      )
  }
}

function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const redirectError = useRedirectSignInError()
  const shownError = error ?? redirectError
  return (
    <CenteredMessage>
      <div className="w-full max-w-sm space-y-6">
        <img src="/icon.svg" alt="" className="mx-auto h-20 w-20" />
        <div>
          <h1 className="text-2xl font-bold">2 Forks 1 Spoon</h1>
          <p className="mt-1 text-stone-600">Plan batches, never run out mid-week, and shop once.</p>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            setError(null)
            signInWithGoogle().catch((e) => setError(signInErrorMessage(e)))
          }}
        >
          Sign in with Google
        </Button>
        <p className="text-sm text-stone-500">Google will ask which account to use. Pick the one your household uses.</p>
        {shownError && <p className="text-sm text-red-700">{shownError}</p>}
      </div>
    </CenteredMessage>
  )
}

function Onboarding({ user, invites }: { user: User; invites: { id: string; name: string }[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    action().catch((e: Error) => {
      setError(e.message)
      setBusy(false)
    })
  }
  return (
    <CenteredMessage>
      <div className="w-full max-w-sm space-y-4 text-left">
        <h1 className="text-center text-2xl font-bold">Welcome, {user.displayName?.split(' ')[0] ?? 'there'}</h1>
        {invites.map((h) => (
          <Card key={h.id} title="You've been invited">
            <p className="mb-3 text-stone-600">Join {h.name} to share recipes, plans and grocery lists.</p>
            <Button className="w-full" disabled={busy} onClick={() => run(() => joinHousehold(user, h.id))}>
              Join {h.name}
            </Button>
          </Card>
        ))}
        <Card title="Start a new household">
          <p className="mb-3 text-stone-600">
            Then invite your partner from Settings using the email address of their Google account.
          </p>
          <Button
            className="w-full"
            variant={invites.length ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={() => run(() => createHousehold(user))}
          >
            Create household
          </Button>
        </Card>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <SwitchAccount user={user} />
      </div>
    </CenteredMessage>
  )
}

/** Shows who is signed in, with a way out if it's the wrong Google account. */
function SwitchAccount({ user }: { user: User }) {
  return (
    <p className="text-center text-sm text-stone-500">
      Signed in as <span className="font-medium text-stone-700">{user.email ?? user.displayName}</span>.{' '}
      <button className="font-medium text-brand-700 underline" onClick={() => signOutUser()}>
        Use a different account
      </button>
    </p>
  )
}

function SetupNeeded() {
  return (
    <CenteredMessage>
      <div className="max-w-md space-y-3 text-left">
        <h1 className="text-xl font-bold">Firebase isn't configured yet</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in the web app config from the Firebase
          console, then restart <code>npm run dev</code>.
        </p>
        <p>
          To try it locally without a Firebase project, set <code>VITE_USE_EMULATORS=true</code> and run{' '}
          <code>npm run emulators</code> alongside the dev server.
        </p>
      </div>
    </CenteredMessage>
  )
}
