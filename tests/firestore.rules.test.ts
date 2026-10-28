import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { joinChanges, newHousehold } from '../src/domain/household'
import type { Household } from '../src/domain/types'

const thomas = { uid: 'thomas', name: 'Thomas', email: 'thomas@example.com' }
const partner = { uid: 'partner', name: 'Sam', email: 'sam@example.com' }
const stranger = { uid: 'stranger', name: 'Eve', email: 'eve@example.com' }

let env: RulesTestEnvironment

function as(user: { uid: string; email: string }, emailVerified = true) {
  return env.authenticatedContext(user.uid, { email: user.email, email_verified: emailVerified }).firestore()
}

const base = (): Household => ({ id: 'h1', ...newHousehold(thomas), invitedEmails: [partner.email] })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-2-forks-1-spoon',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { id, ...data } = base()
    await setDoc(doc(ctx.firestore(), 'households', id), data)
    await setDoc(doc(ctx.firestore(), 'households', id, 'recipes', 'r1'), { title: 'Chili' })
  })
})

describe('household documents', () => {
  it('lets a user create a household that contains only themselves', async () => {
    await assertSucceeds(setDoc(doc(as(stranger), 'households', 'h2'), newHousehold(stranger)))
    await assertFails(
      setDoc(doc(as(stranger), 'households', 'h3'), { ...newHousehold(stranger), memberUids: ['stranger', 'thomas'] }),
    )
  })

  it('lets members read and query; hides it from strangers', async () => {
    await assertSucceeds(getDoc(doc(as(thomas), 'households', 'h1')))
    await assertSucceeds(
      getDocs(query(collection(as(thomas), 'households'), where('memberUids', 'array-contains', 'thomas'))),
    )
    await assertFails(getDoc(doc(as(stranger), 'households', 'h1')))
  })

  it('lets invitees with a verified email read and query by invite', async () => {
    await assertSucceeds(getDoc(doc(as(partner), 'households', 'h1')))
    await assertSucceeds(
      getDocs(query(collection(as(partner), 'households'), where('invitedEmails', 'array-contains', partner.email))),
    )
    await assertFails(getDoc(doc(as(partner, false), 'households', 'h1')))
  })

  it('lets an invitee join by appending only themselves', async () => {
    await assertSucceeds(updateDoc(doc(as(partner), 'households', 'h1'), joinChanges(base(), partner)))
  })

  it('stops invitees from changing anything else or adding other people', async () => {
    await assertFails(updateDoc(doc(as(partner), 'households', 'h1'), { ...joinChanges(base(), partner), name: 'Mine' }))
    await assertFails(updateDoc(doc(as(partner), 'households', 'h1'), joinChanges(base(), stranger)))
    await assertFails(updateDoc(doc(as(stranger), 'households', 'h1'), joinChanges(base(), stranger)))
  })

  it('lets members edit but not remove themselves; nobody can delete', async () => {
    const db = as(thomas)
    await assertSucceeds(updateDoc(doc(db, 'households', 'h1'), { name: 'Our house' }))
    await assertFails(updateDoc(doc(db, 'households', 'h1'), { memberUids: [] }))
    await assertFails(deleteDoc(doc(db, 'households', 'h1')))
  })
})

describe('household sub-collections', () => {
  it('are readable and writable by members only', async () => {
    await assertSucceeds(getDoc(doc(as(thomas), 'households/h1/recipes/r1')))
    await assertSucceeds(setDoc(doc(as(thomas), 'households/h1/batches/b1'), { recipeId: 'r1' }))
    await assertFails(getDoc(doc(as(stranger), 'households/h1/recipes/r1')))
    await assertFails(setDoc(doc(as(stranger), 'households/h1/batches/b2'), { recipeId: 'r1' }))
    // Being invited is not enough to see the data before joining.
    await assertFails(getDoc(doc(as(partner), 'households/h1/recipes/r1')))
  })
})
