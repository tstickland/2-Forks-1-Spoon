import { useState, type FormEvent } from 'react'
import { useHouseholdContext } from '../../app/HouseholdContext'
import { signOutUser } from '../../data/auth'
import { inviteEmail, revokeInvite, updateHousehold } from '../../data/household'
import { addDays, formatShort, recurringDates, today } from '../../domain/dates'
import { slotEaters } from '../../domain/household'
import type { Household, Macros, Member, ShoppingSchedule } from '../../domain/types'
import { Button, Card, Field, Input, PageHeader } from '../../ui/components'

export function SettingsPage() {
  const { user, household } = useHouseholdContext()
  return (
    <>
      <PageHeader title="Settings">
        <Button variant="secondary" onClick={() => signOutUser()}>
          Sign out
        </Button>
      </PageHeader>
      <p className="-mt-2 mb-4 text-sm text-stone-500">
        Signed in as <span className="font-medium text-stone-700">{user.email}</span>
      </p>
      <div className="space-y-4">
        {/* Keyed by content so drafts reset when the other phone saves a change. */}
        <HouseholdName key={household.name} household={household} />
        {household.members.map((m) => (
          <MemberSettings key={JSON.stringify([m, household.slots])} household={household} member={m} isMe={m.uid === user.uid} />
        ))}
        <Invites household={household} />
        <Schedule key={JSON.stringify(household.schedule)} household={household} />
      </div>
    </>
  )
}

function useSaver() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle')
  const save = (action: Promise<void>) => {
    setState('saving')
    action.then(() => setState('saved')).catch((e: Error) => setState(e.message))
  }
  const status =
    state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'idle' ? '' : `Error: ${state}`
  return { save, status }
}

function SaveRow({ status, disabled }: { status: string; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      <span className="text-sm text-stone-500">{status}</span>
      <Button type="submit" disabled={disabled}>
        Save
      </Button>
    </div>
  )
}

function NumberInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.valueAsNumber)}
    />
  )
}

function HouseholdName({ household }: { household: Household }) {
  const [name, setName] = useState(household.name)
  const { save, status } = useSaver()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save(updateHousehold(household.id, { name: name.trim() }))
  }
  return (
    <Card title="Household">
      <form onSubmit={submit}>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <SaveRow status={status} disabled={!name.trim()} />
      </form>
    </Card>
  )
}

const MACRO_FIELDS: { key: keyof Macros; label: string }[] = [
  { key: 'kcal', label: 'Calories' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbs', label: 'Carbs (g)' },
  { key: 'fat', label: 'Fat (g)' },
]

function MemberSettings({ household, member, isMe }: { household: Household; member: Member; isMe: boolean }) {
  const [draft, setDraft] = useState(member)
  const { save, status } = useSaver()
  const mySlots = household.slots.filter((s) => slotEaters(household, s).some((m) => m.uid === member.uid))
  const valid = draft.name.trim() && Object.values(draft.macroTargets).every(Number.isFinite)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const members = household.members.map((m) => (m.uid === member.uid ? { ...draft, name: draft.name.trim() } : m))
    save(updateHousehold(household.id, { members }))
  }

  return (
    <Card title={isMe ? `${member.name} (you)` : member.name}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Daily macro targets</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MACRO_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label}>
                <NumberInput
                  value={draft.macroTargets[key]}
                  onChange={(n) => setDraft({ ...draft, macroTargets: { ...draft.macroTargets, [key]: n } })}
                />
              </Field>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Default portions (g)</h3>
          <div className="grid grid-cols-2 gap-3">
            {mySlots.map((slot) => (
              <Field key={slot.id} label={slot.name}>
                <NumberInput
                  value={draft.defaultPortionG[slot.id] ?? 0}
                  onChange={(n) =>
                    setDraft({ ...draft, defaultPortionG: { ...draft.defaultPortionG, [slot.id]: n } })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
        <SaveRow status={status} disabled={!valid} />
      </form>
    </Card>
  )
}

function Invites({ household }: { household: Household }) {
  const [email, setEmail] = useState('')
  const { save, status } = useSaver()
  const memberEmails = new Set(household.members.map((m) => m.email))
  const pending = household.invitedEmails.filter((e) => !memberEmails.has(e))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save(inviteEmail(household.id, email).then(() => setEmail('')))
  }

  return (
    <Card title="Invite your partner">
      <p className="mb-3 text-sm text-stone-600">
        Enter the email address of their Google account. When they sign in, they'll be offered this household.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" />
        <Button type="submit">Invite</Button>
      </form>
      {status && <p className="mt-2 text-sm text-stone-500">{status}</p>}
      {pending.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100">
          {pending.map((e) => (
            <li key={e} className="flex items-center justify-between py-2 text-sm">
              <span>{e} — pending</span>
              <Button variant="danger" onClick={() => save(revokeInvite(household.id, e))}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Schedule({ household }: { household: Household }) {
  const [draft, setDraft] = useState<ShoppingSchedule[]>(household.schedule)
  const { save, status } = useSaver()
  const valid = draft.every((s) => Number.isInteger(s.everyDays) && s.everyDays > 0 && s.anchorDate)
  const start = today()

  const update = (i: number, changes: Partial<ShoppingSchedule>) =>
    setDraft(draft.map((s, j) => (j === i ? { ...s, ...changes } : s)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save(updateHousehold(household.id, { schedule: draft }))
  }

  return (
    <Card title="Shopping schedule">
      <form onSubmit={submit} className="space-y-4">
        {draft.map((s, i) => (
          <div key={s.store} className="space-y-2">
            <h3 className="text-sm font-semibold">{s.store}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Every (days)">
                <NumberInput value={s.everyDays} onChange={(n) => update(i, { everyDays: n })} />
              </Field>
              <Field label="A trip date">
                <Input type="date" value={s.anchorDate} onChange={(e) => update(i, { anchorDate: e.target.value })} />
              </Field>
            </div>
            {valid && (
              <p className="text-sm text-stone-500">
                Next:{' '}
                {recurringDates(s.anchorDate, s.everyDays, start, addDays(start, s.everyDays * 3))
                  .slice(0, 3)
                  .map(formatShort)
                  .join(' · ')}
              </p>
            )}
          </div>
        ))}
        <SaveRow status={status} disabled={!valid} />
      </form>
    </Card>
  )
}
