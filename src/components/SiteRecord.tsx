import { LoopMark } from './LoopMark'
import { loopPosition } from '../lib/lifecycle'
import { timeAgo, type Site, type SiteDetail } from '../lib/sites'
import type { SiteDisplay } from '../lib/api-client'

/**
 * Tone colours come from the heat ramp the map legend already uses, so one
 * colour vocabulary covers the whole app. The server grades tone against each
 * road's own target: a City of Miami pothole has 30 business days where a
 * county one has 90.
 */
const TONE: Record<SiteDisplay['tone'], string | undefined> = {
  ok: undefined,
  warn: '#f4722b',
  critical: '#d4342a',
  done: undefined,
}

const onDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-[88px] shrink-0 text-[12px] text-ink-3">{label}</dt>
      <dd
        className="min-w-0 flex-1 text-[13px] leading-snug font-medium"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Where this sits on the loop, and the county's case record underneath.
 *
 * The record is a labelled list rather than sentences on purpose. The same
 * facts written as prose read as something an app made up; set out as case
 * number, queue, target and last update, with the source and the time it was
 * checked, they read as what they are, which is a transcription of Miami-Dade
 * 311. Every value here is a field from the county, none of it is composed.
 */
export function SiteRecord({ site, detail }: { site: Site; detail: SiteDetail | null }) {
  const progress = detail?.progress ?? null
  const loop = loopPosition(site, progress)
  const { display } = site
  const tone = TONE[display.tone]

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-4">
        <LoopMark size={60} total={loop.total} segments={loop.index + 1} ghost animateIn />

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            Stage {loop.index + 1} of {loop.total}
          </p>
          <p className="mt-0.5 text-[18px] leading-tight font-bold tracking-[-0.01em]">
            {display.statusLabel}
          </p>
          {loop.next && <p className="mt-0.5 text-[13px] text-ink-3">Next: {loop.next}</p>}
        </div>
      </div>

      <dl className="mt-3 divide-y divide-line border-t border-line">
        {progress?.caseNumber && <Row label="Case" value={progress.caseNumber} />}
        {progress?.owner && <Row label="Queue" value={progress.owner} />}
        {site.department && <Row label="Department" value={site.department} />}
        {(progress?.slaTarget ?? site.sla) && (
          <Row label="Target" value={(progress?.slaTarget ?? site.sla) as string} />
        )}
        {display.overdue && (
          <Row label="Overdue" value={`${display.overdue.days} days`} tone={tone} />
        )}
        {progress?.sla?.expectedAt && (
          <Row label="Due" value={onDate(progress.sla.expectedAt)} />
        )}
        {progress?.lastUpdatedAt && (
          <Row label="Updated" value={onDate(progress.lastUpdatedAt)} />
        )}
        {/* The county closed the case without repairing the road. Never let
            this read as fixed. */}
        {progress?.status === 'closed_unresolved' && (
          <Row label="Outcome" value="Closed without a repair" tone={TONE.critical} />
        )}
        {site.canFileWith311 === false && (
          <Row label="Maintained" value="By the city, not the county" />
        )}
      </dl>

      {progress?.checkedAt && (
        <p className="mt-2.5 text-[11px] text-ink-3">
          Miami-Dade 311, checked {timeAgo(progress.checkedAt)}
        </p>
      )}
    </section>
  )
}
