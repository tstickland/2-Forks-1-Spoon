import { slotEaters } from './household'
import type { Household, IsoDate, MealEntry, Slot } from './types'

/** One entry per person per slot per day, so the id is derived from those three. */
export function mealEntryId(date: IsoDate, slotId: string, personUid: string): string {
  return `${date}_${slotId}_${personUid}`
}

export const FALLBACK_PORTION_G = 400

/** A person's default portion for a slot. */
export function defaultPortion(household: Pick<Household, 'members'>, personUid: string, slotId: string): number {
  return household.members.find((m) => m.uid === personUid)?.defaultPortionG[slotId] ?? FALLBACK_PORTION_G
}

export interface Assignment {
  batchId: string
  /** Grams per person; people missing from the map aren't eating this meal. */
  gramsByPerson: Record<string, number>
}

export interface EntryChanges {
  set: MealEntry[]
  remove: string[]
}

/**
 * Entries to write and remove so the slot on each date matches the assignment.
 * Passing `null` clears the slot on those dates.
 */
export function assignSlot(
  household: Pick<Household, 'members'>,
  slot: Slot,
  dates: IsoDate[],
  assignment: Assignment | null,
): EntryChanges {
  const changes: EntryChanges = { set: [], remove: [] }
  for (const date of dates) {
    for (const person of slotEaters(household, slot)) {
      const id = mealEntryId(date, slot.id, person.uid)
      const grams = assignment?.gramsByPerson[person.uid]
      if (assignment && grams !== undefined && grams > 0) {
        changes.set.push({ id, date, slotId: slot.id, personUid: person.uid, batchId: assignment.batchId, grams })
      } else {
        changes.remove.push(id)
      }
    }
  }
  return changes
}

/** Entries in a slot on a date, keyed by person. */
export function slotEntries(entries: MealEntry[], date: IsoDate, slotId: string): Map<string, MealEntry> {
  return new Map(entries.filter((e) => e.date === date && e.slotId === slotId).map((e) => [e.personUid, e]))
}
