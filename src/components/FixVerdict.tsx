import { Check, RotateCw, Hourglass } from 'lucide-react'
import { fixSignal, type SiteDetail } from '../lib/sites'

const STILL_THERE = '#d4342a'

const on = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Did the repair hold?
 *
 * The working is shown rather than a badge, because the whole claim rests on
 * the comparison: silence only counts once it beats every lull this place has
 * had before. A reader who disagrees can check the number against the history
 * directly below.
 */
export function FixVerdict({ site }: { site: SiteDetail }) {
  const signal = fixSignal(site)
  if (!signal) return null

  const { state, silenceDays, longestQuietDays, reportsSince, repairedAt } = signal

  const Icon = state === 'still-there' ? RotateCw : state === 'likely-fixed' ? Check : Hourglass
  const headline =
    state === 'still-there'
      ? 'Reported again after the repair'
      : state === 'likely-fixed'
        ? 'Quieter than it has ever been'
        : 'Too soon to tell'

  const working =
    state === 'still-there'
      ? `${reportsSince} ${reportsSince === 1 ? 'complaint' : 'complaints'} since the county closed it on ${on(repairedAt)}.`
      : state === 'likely-fixed'
        ? `${silenceDays} days quiet since ${on(repairedAt)}. The longest it ever went before was ${longestQuietDays} days.`
        : `${silenceDays} days quiet since ${on(repairedAt)}, but it has gone ${longestQuietDays} days without a complaint before.`

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <Icon
          size={17}
          strokeWidth={2.3}
          className="mt-0.5 shrink-0"
          style={state === 'still-there' ? { color: STILL_THERE } : undefined}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] leading-snug font-bold tracking-[-0.01em]"
            style={state === 'still-there' ? { color: STILL_THERE } : undefined}
          >
            {headline}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink-3">{working}</p>
        </div>
      </div>
    </section>
  )
}
