import { Check } from 'lucide-react'
import { isSettled, type Site } from '../lib/sites'
import { ReportMeta } from './ReportMeta'

/** A site in a list: photo, what it is, the standardised facts, how many
 *  people have reported it. Identical on every screen. */
export function ReportRow({
  site,
  title,
  onClick,
}: {
  site: Site
  title: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="press flex w-full items-center gap-3 py-3 text-left">
      {site.thumbnails[0] ? (
        <img
          src={site.thumbnails[0]}
          alt=""
          loading="lazy"
          className="size-12 shrink-0 rounded-btn bg-surface-2 object-cover"
        />
      ) : (
        <span className="size-12 shrink-0 rounded-btn bg-surface-2" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15.5px] leading-[21px] font-semibold tracking-[-0.01em] text-heading">
          {title}
        </span>
        <ReportMeta site={site} variant="row" className="mt-0.5 max-w-full text-[13px] text-ink-3" />
      </span>
      {/* A list of open problems needs to say which ones are not. */}
      {isSettled(site) ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-answered-bg text-answered">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold">
          {site.reportCount}
        </span>
      )}
    </button>
  )
}
