import { ShieldAlert } from 'lucide-react'
import { placeOf, timeAgo, isDisputed, type Site } from '../lib/sites'
import { useMultiCategory } from '../lib/categories'

/**
 * The one place site facts are formatted, so every surface states them the
 * same way and in the same order: where, when, how many reports, and whether
 * the county and the residents disagree.
 */
export const meta = {
  category: (s: Site) => s.display.title,
  place: (s: Site) => placeOf(s),
  /** Sites are dated by their most recent complaint, not their first. */
  when: (s: Site) => timeAgo(s.lastReportedAt),
  reports: (s: Site) => `${s.reportCount} ${s.reportCount === 1 ? 'report' : 'reports'}`,
  reportsLong: (s: Site) =>
    `${s.reportCount} ${s.reportCount === 1 ? 'person has' : 'people have'} reported this`,
  openFor: (s: Site) => (s.daysOpen === null ? null : `open ${s.daysOpen} days`),
}

interface ReportMetaProps {
  site: Site
  /** 'row' for lists, 'card' for the open site. */
  variant: 'row' | 'card'
  className?: string
}

export function ReportMeta({ site, variant, className = '' }: ReportMetaProps) {
  // With one category enabled, naming it on every row says nothing and costs
  // the timestamp its space.
  const manyCategories = useMultiCategory()
  // A site with no municipality yields an empty place, which would otherwise
  // render as a stray separator.
  const parts = (
    variant === 'row'
      ? [...(manyCategories ? [meta.category(site)] : []), meta.place(site), meta.when(site)]
      : [meta.when(site), meta.reportsLong(site)]
  ).filter(Boolean)

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="truncate">{parts.join(' · ')}</span>
      {isDisputed(site) && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">
          <ShieldAlert size={11} strokeWidth={2.6} />
          disputed
        </span>
      )}
    </span>
  )
}
