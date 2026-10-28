import { addDays, formatShort } from '../../domain/dates'
import type { TripList } from '../../domain/grocery'

/** "Your plan stops before the next Costco trip, so this list may be missing things." */
export function PlanGapWarning({ gap, store, compact }: { gap: NonNullable<TripList['planGap']>; store: string; compact?: boolean }) {
  const until = gap.plannedUntil ? `Your plan goes to ${formatShort(gap.plannedUntil)}` : 'Nothing is planned yet'
  const needed = formatShort(addDays(gap.nextTrip, -1))
  return (
    <p className={`rounded-lg bg-amber-50 text-amber-900 ring-1 ring-amber-200 ${compact ? 'mt-2 px-2 py-1 text-xs' : 'p-3 text-sm'}`}>
      ⚠ {until}. The next {store} trip is {formatShort(gap.nextTrip)}, so plan batches up to {needed} to make this list complete.
    </p>
  )
}
