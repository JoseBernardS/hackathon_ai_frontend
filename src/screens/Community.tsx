import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  byMunicipality,
  listSites,
  addressOf,
  withinRange,
  type Range,
  type Site,
} from '../lib/sites'
import { RangePills } from '../components/RangePills'
import { ReportRow } from '../components/ReportRow'
import { useRegistry, liveCategory, typicalDays } from '../lib/categories'

/**
 * The county-scale view: where the county's record and the street disagree,
 * what keeps getting reported, and which areas carry the weight.
 *
 * Home answers "what is near me"; this answers "what is wrong with the area",
 * so it deliberately does not repeat Home's feed.
 */
export function Community({ onOpenReport }: { onOpenReport: (id: string) => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [range, setRange] = useState<Range>('all')
  const registry = useRegistry()
  const category = registry ? liveCategory(registry) ?? null : null

  useEffect(() => {
    listSites({ status: 'all', limit: 400 })
      .then(setSites)
      .catch(() => setSites([]))
  }, [])

  const visible = useMemo(() => sites.filter((s) => withinRange(s, range)), [sites, range])

  // The county closed the case and residents say otherwise. This is the one
  // worth leading with, so it is not buried under the volume rankings.
  const disputes = useMemo(
    () => visible.filter((s) => s.reconciliation?.disputed),
    [visible],
  )

  // Repeatedly reported: the same place, filed again and again.
  const repeats = useMemo(
    () =>
      visible
        .filter((s) => s.reportCount >= 5 && !s.reconciliation?.disputed)
        .sort((a, b) => b.reportCount - a.reportCount)
        .slice(0, 10),
    [visible],
  )

  const areas = useMemo(() => byMunicipality(visible), [visible])
  const busiest = areas[0]?.reports ?? 1
  const reports = visible.reduce((sum, s) => sum + s.reportCount, 0)
  const open = visible.filter((s) => s.status === 'open').length

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="px-5 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
        <h1 className="py-3 text-[30px] font-bold tracking-[-0.025em]">Community</h1>

        <RangePills value={range} onChange={setRange} className="mt-0.5" />

        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          {visible.length} locations, {open} still open, from {reports} reports.
          {category && ` Typically fixed in ${typicalDays(category)} days.`}
        </p>

        {disputes.length > 0 && (
          <section className="mt-7">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={16} strokeWidth={2.4} />
              <h2 className="text-[18px] font-bold tracking-[-0.01em]">Closed but not fixed</h2>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">
              The county closed the case. Residents say the problem is still there.
            </p>

            <ul className="mt-1 divide-y divide-line">
              {disputes.map((site) => (
                <li key={site.id}>
                  <ReportRow
                    site={site}
                    title={addressOf(site)}
                    onClick={() => onOpenReport(site.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {repeats.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[18px] font-bold tracking-[-0.01em]">Reported again and again</h2>
              <span className="shrink-0 text-[13px] text-ink-3">{repeats.length} shown</span>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">Five or more complaints at one spot.</p>

            <ul className="mt-1 divide-y divide-line">
              {repeats.map((site) => (
                <li key={site.id}>
                  <ReportRow
                    site={site}
                    title={addressOf(site)}
                    onClick={() => onOpenReport(site.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-[18px] font-bold tracking-[-0.01em]">Busiest areas</h2>
          <ul className="mt-3 space-y-2.5">
            {areas.map((area) => (
              <li key={area.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold">{area.name}</span>
                  <span className="shrink-0 text-[13px] text-ink-3">
                    {area.sites} · {area.reports} reports
                  </span>
                </div>
                {/* Bar length is the comparison; the number is the value. */}
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${Math.round((area.reports / busiest) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
