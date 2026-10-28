import type { IsoDate } from './types'

// Calendar-date helpers. All arithmetic is done in UTC on date-only values so that
// daylight-saving changes can never shift a date.

const DAY_MS = 24 * 60 * 60 * 1000

function toUtcMs(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Today's local calendar date. */
export function today(now: Date = new Date()): IsoDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: IsoDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7
}

/** The Monday on or before the given date. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -weekdayIndex(date))
}

/** Inclusive list of dates from start to end. */
export function dateRange(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mon 2 Nov" */
export function formatShort(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number)
  return `${WEEKDAYS[weekdayIndex(date)]} ${d} ${MONTHS[m - 1]}`
}

/**
 * Trip dates for a repeating schedule within [from, to], inclusive.
 * The anchor may be before, inside or after the range.
 */
export function recurringDates(anchor: IsoDate, everyDays: number, from: IsoDate, to: IsoDate): IsoDate[] {
  const offset = daysBetween(anchor, from)
  const firstStep = Math.ceil(offset / everyDays)
  const out: IsoDate[] = []
  for (let d = addDays(anchor, firstStep * everyDays); d <= to; d = addDays(d, everyDays)) out.push(d)
  return out
}
