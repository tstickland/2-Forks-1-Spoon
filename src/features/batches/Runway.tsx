import { Link } from 'react-router-dom'
import { formatScale } from '../../domain/batch'
import { forecastProblems, type BatchForecast } from '../../domain/forecast'
import type { Batch, Recipe } from '../../domain/types'
import { Button } from '../../ui/components'
import { batchSubtitle, batchTint, runwaySummary } from './runwayText'

/** Planned vs available, as a bar: green is covered, red is the shortfall. */
export function RunwayBar({ forecast }: { forecast: BatchForecast }) {
  const { weightG, plannedG } = forecast
  if (weightG === undefined) {
    return <div className="h-2 rounded-full bg-[repeating-linear-gradient(45deg,#e7e5e4,#e7e5e4_4px,#f5f5f4_4px,#f5f5f4_8px)]" />
  }
  const total = Math.max(weightG, plannedG, 1)
  const covered = Math.min(plannedG, weightG)
  const short = Math.max(plannedG - weightG, 0)
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-stone-200" title={`${plannedG} g planned of ${weightG} g`}>
      <div className="bg-brand-600" style={{ width: `${(covered / total) * 100}%` }} />
      <div className="bg-red-500" style={{ width: `${(short / total) * 100}%` }} />
    </div>
  )
}

export function BatchRunway({
  batch,
  recipe,
  forecast,
  onScale,
  link = true,
}: {
  batch: Batch
  recipe?: Recipe
  forecast: BatchForecast
  onScale?: (scale: number) => void
  link?: boolean
}) {
  const problems = forecastProblems(forecast)
  const title = recipe?.title ?? 'Deleted recipe'
  return (
    <div className={`rounded-xl p-3 ring-1 ${batchTint(batch.id)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {link ? (
            <Link to={`/batches/${batch.id}`} className="font-medium hover:underline">
              {title}
            </Link>
          ) : (
            <span className="font-medium">{title}</span>
          )}
          <div className="text-xs text-stone-600">{batchSubtitle(batch, forecast)}</div>
        </div>
        {batch.status === 'cooked' && <span className="shrink-0 text-xs font-medium text-brand-700">Cooked</span>}
      </div>
      <div className="mt-2">
        <RunwayBar forecast={forecast} />
      </div>
      <div className="mt-1 text-xs text-stone-600">{runwaySummary(forecast)}</div>
      {problems.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-red-700">
          {problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}
      {forecast.suggestedScale !== undefined && onScale && (
        <Button className="mt-2 !px-3 !py-1" onClick={() => onScale(forecast.suggestedScale!)}>
          Scale to {formatScale(forecast.suggestedScale)}
        </Button>
      )}
    </div>
  )
}
