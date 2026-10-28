import { addDays, today } from './dates'
import type { Household, Member, Slot } from './types'

export interface NewMember {
  uid: string
  name: string
  email: string
}

export const DINNER_SLOT_ID = 'dinner'

const DEFAULT_TARGETS = { kcal: 2000, protein: 150, carbs: 200, fat: 70 }
const DEFAULT_LUNCH_G = 400
const DEFAULT_DINNER_G = 450

export function lunchSlotId(uid: string): string {
  return `lunch-${uid}`
}

function memberFrom(m: NewMember): Member {
  return {
    uid: m.uid,
    name: m.name,
    email: m.email.toLowerCase(),
    macroTargets: { ...DEFAULT_TARGETS },
    defaultPortionG: { [lunchSlotId(m.uid)]: DEFAULT_LUNCH_G, [DINNER_SLOT_ID]: DEFAULT_DINNER_G },
  }
}

function lunchSlot(m: NewMember): Slot {
  return { id: lunchSlotId(m.uid), name: `${m.name.split(' ')[0]}'s lunch`, shared: false, ownerUid: m.uid }
}

/** A fresh household owned by its creator: their lunch slot, a shared dinner, and a staggered Costco/grocery schedule. */
export function newHousehold(owner: NewMember, now: Date = new Date()): Omit<Household, 'id'> {
  const start = today(now)
  return {
    name: `${owner.name.split(' ')[0]}'s household`,
    memberUids: [owner.uid],
    invitedEmails: [],
    members: [memberFrom(owner)],
    slots: [lunchSlot(owner), { id: DINNER_SLOT_ID, name: 'Dinner', shared: true }],
    schedule: [
      { store: 'Costco', everyDays: 14, anchorDate: start },
      { store: 'Grocery', everyDays: 14, anchorDate: addDays(start, 7) },
    ],
  }
}

/** The household fields that change when an invited person joins. */
export function joinChanges(h: Household, joiner: NewMember): Pick<Household, 'memberUids' | 'members' | 'slots'> {
  if (h.memberUids.includes(joiner.uid)) return { memberUids: h.memberUids, members: h.members, slots: h.slots }
  // Personal slots go before shared ones so the plan grid reads lunch, lunch, dinner.
  const firstShared = h.slots.findIndex((s) => s.shared)
  const at = firstShared === -1 ? h.slots.length : firstShared
  return {
    memberUids: [...h.memberUids, joiner.uid],
    members: [...h.members, memberFrom(joiner)],
    slots: [...h.slots.slice(0, at), lunchSlot(joiner), ...h.slots.slice(at)],
  }
}

/** Members a slot is eaten by: everyone for shared slots, the owner otherwise. */
export function slotEaters(h: Pick<Household, 'members'>, slot: Slot): Member[] {
  return slot.shared ? h.members : h.members.filter((m) => m.uid === slot.ownerUid)
}
