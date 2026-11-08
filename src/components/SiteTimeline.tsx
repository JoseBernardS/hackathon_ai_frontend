import { useState } from 'react'
import { Landmark } from 'lucide-react'
import type { SiteDetail } from '../lib/sites'

const monthKey = (iso: string) => iso.slice(0, 7)

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

interface Month {
  key: string
  filed: number
  closed: number
}

/**
 * How often this place gets reported, and whether anything came of it.
 *
 * Listing every complaint produced twenty-eight rows that differed only by
 * date and case number, which buries the one thing that matters: the cadence.
 * Grouping by month shows a problem reported steadily for half a year in a
 * shape you can read at a glance. The individual cases are still there, one
 * tap away, because the case numbers are what make it checkable.
 */
export function SiteTimeline({ site }: { site: SiteDetail }) {
  const [expanded, setExpanded] = useState(false)
  if (site.reports.length === 0) return null

  const months = new Map<string, Month>()
  site.reports.forEach((report) => {
    const key = monthKey(report.reportedAt)
    const row = months.get(key) ?? { key, filed: 0, closed: 0 }
    row.filed += 1
    months.set(key, row)
  })
  site.reports.forEach((report) => {
    if (!report.closedAt) return
    const key = monthKey(report.closedAt)
    const row = months.get(key) ?? { key, filed: 0, closed: 0 }
    row.closed += 1
    months.set(key, row)
  })

  const rows = [...months.values()].sort((a, b) => b.key.localeCompare(a.key))
  const busiest = Math.max(...rows.map((r) => r.filed), 1)
  // A closed column earns its space only when something was actually closed.
  const anyClosed = rows.some((r) => r.closed > 0)

  const dates = site.reports.map((r) => r.reportedAt).sort()
  const closed = site.reports.filter((r) => r.closedAt).length

  return (
    <section className="rounded-xl border border-line p-4">
      <h3 className="text-[15px] font-semibold">Reported since {monthLabel(monthKey(dates[0]))}</h3>
      <p className="mt-0.5 text-[12px] text-ink-3">
        {site.reports.length} {site.reports.length === 1 ? 'complaint' : 'complaints'},{' '}
        {closed === 0 ? 'none closed' : `${closed} closed`}
      </p>

      {!expanded && (
        <div className="mt-3">
          <div className="flex items-center gap-2.5 pb-1.5 text-[11px] tracking-[0.04em] text-ink-3 uppercase">
            <span className="w-[62px] shrink-0" />
            <span className="min-w-0 flex-1" />
            <span className="w-[30px] shrink-0 text-right">Filed</span>
            {anyClosed && <span className="w-[42px] shrink-0 text-right">Closed</span>}
          </div>

          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-2.5">
                <span className="w-[62px] shrink-0 text-[12px] text-ink-3">
                  {monthLabel(row.key)}
                </span>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${Math.round((row.filed / busiest) * 100)}%` }}
                  />
                </span>
                <span className="w-[30px] shrink-0 text-right text-[12px] font-semibold tabular-nums">
                  {row.filed || ''}
                </span>
                {anyClosed && (
                  <span className="w-[42px] shrink-0 text-right text-[12px] text-ink-3 tabular-nums">
                    {row.closed || ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {expanded && (
        <ol className="mt-3 space-y-3">
          {[...site.reports]
            .sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt))
            .map((report) => (
              <li key={report.id} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-ink-3">
                  <Landmark size={14} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug font-medium">
                    {report.source === 'user' ? 'Reported in the app' : 'Reported to 311'}
                    {report.closedAt && ', since closed'}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {fullDate(report.reportedAt)}
                    {report.sourceId ? ` · Case ${report.sourceId}` : ''}
                  </p>
                </div>
              </li>
            ))}
        </ol>
      )}

      <button
        onClick={() => setExpanded((on) => !on)}
        className="press mt-3 text-[13px] font-semibold text-ink-2"
      >
        {expanded ? 'Show by month' : `Show all ${site.reports.length} cases`}
      </button>
    </section>
  )
}
