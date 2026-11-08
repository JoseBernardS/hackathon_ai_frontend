import { useEffect, useMemo, useState } from 'react'
import {
  LocateFixed,
  LocateOff,
  Locate,
  Check,
  RotateCw,
  MessageSquareText,
  Plus,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { LoopMap } from '../components/LoopMap'
import { LoopMark } from '../components/LoopMark'
import { ReportMeta } from '../components/ReportMeta'
import { ReportRow } from '../components/ReportRow'
import { RangePills } from '../components/RangePills'
import { BottomSheet } from '../components/BottomSheet'
import { SiteRecord } from '../components/SiteRecord'
import { SiteTimeline } from '../components/SiteTimeline'
import { CategoryIcon } from '../components/CategoryIcon'
import { ReportForum } from '../components/ReportForum'
import { ReportFlow } from './ReportFlow'
import { useUserLocation } from '../lib/geo'
import { useRegistry, liveCategory, supports } from '../lib/categories'
import {
  listSites,
  getSite,
  latLngOf,
  titleOf,
  addressOf,
  withinRange,
  type Range,
  type Site,
  type SiteDetail,
} from '../lib/sites'
import api, { ApiError } from '../lib/api-client'
import { seedForum, type ForumPost } from '../lib/forum'

export function Home() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SiteDetail | null>(null)
  // Empty means no filter, which reads as "All". Holds category codes.
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [range, setRange] = useState<Range>('all')
  const [disputedOnly, setDisputedOnly] = useState(false)
  const [location, requestLocation] = useUserLocation()
  const registry = useRegistry()
  const category = registry ? (liveCategory(registry) ?? null) : null
  // Always rendered: a category enabled on the server appears here with no
  // client change, which is the point of reading the registry.
  const categories = registry?.categories ?? []
  const [reportOpen, setReportOpen] = useState(false)
  // 0 peek, 1 half, 2 nearly full. The map is always full height behind it.
  const [sheet, setSheet] = useState(1)
  const [sheetHeight, setSheetHeight] = useState(0)
  // Forum threads stay local: the backend has no endpoint for them.
  const [threads, setThreads] = useState<Record<string, ForumPost[]>>({})
  const [postVotes, setPostVotes] = useState<Set<string>>(new Set())
  const [forumOpen, setForumOpen] = useState(false)
  // "Affects me too" and the fixed/still-there verdicts. Local state, as they
  // have been from the start; the affects tap also files a real report when
  // the user is signed in, which is what makes the count move.
  const [affects, setAffects] = useState<Set<string>>(new Set())
  const [verdicts, setVerdicts] = useState<Record<string, 'fixed' | 'still'>>({})
  const [vouchNote, setVouchNote] = useState<string | null>(null)

  // Resolved sites are included so a closed case the residents dispute is
  // still on the map; that disagreement is the point.
  const load = () =>
    listSites({ status: 'all', limit: 400 })
      .then(setSites)
      .catch(() => setSites([]))

  useEffect(() => {
    load()
  }, [])

  // The detail call is what carries the report timeline behind a pin.
  useEffect(() => {
    setDetail(null)
    setVouchNote(null)
    if (!selectedId) return
    let live = true
    getSite(selectedId)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail(null))
    return () => {
      live = false
    }
  }, [selectedId])

  const visible = useMemo(
    () =>
      sites.filter(
        (s) =>
          withinRange(s, range) &&
          (filters.size === 0 || filters.has(s.categoryCode)) &&
          (!disputedOnly || s.reconciliation?.disputed),
      ),
    [sites, filters, range, disputedOnly],
  )

  const selected = useMemo(
    () => visible.find((s) => s.id === selectedId) ?? null,
    [visible, selectedId],
  )

  const userPoint =
    location.status === 'ok' && location.inside
      ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy }
      : null

  // Nearest first when we know where they are, worst first when we do not.
  const ranked = useMemo(() => {
    const list = [...visible]
    if (userPoint) {
      const d = (s: Site) => {
        const [lat, lng] = latLngOf(s)
        return (lat - userPoint.lat) ** 2 + (lng - userPoint.lng) ** 2
      }
      return list.sort((a, b) => d(a) - d(b)).slice(0, 25)
    }
    return list.sort((a, b) => b.reportCount - a.reportCount).slice(0, 25)
  }, [visible, userPoint])

  const disputeCount = useMemo(
    () => sites.filter((s) => s.reconciliation?.disputed).length,
    [sites],
  )

  const postsFor = (id: string) => threads[id] ?? seedForum(id)

  const addPost = (id: string, body: string, parentId: string | null) =>
    setThreads((prev) => ({
      ...prev,
      [id]: [
        ...(prev[id] ?? seedForum(id)),
        {
          id: `${id}-${Date.now()}`,
          author: 'You',
          body,
          createdAt: new Date().toISOString(),
          score: 0,
          parentId,
          mine: true,
        },
      ],
    }))

  const votePost = (postId: string) =>
    setPostVotes((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })

  const toggle = (id: string) => {
    setSelectedId(null)
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * "Affects me too" files a report at the same spot. The backend dedupes it
   * into this site, so the count moves and no second pin appears. A duplicate
   * is still evidence the problem was never fixed.
   */
  const toggleAffects = async (site: Site) => {
    const already = affects.has(site.id)
    setAffects((prev) => {
      const next = new Set(prev)
      if (already) next.delete(site.id)
      else next.add(site.id)
      return next
    })
    if (already || !api.auth.isSignedIn()) return

    const [lat, lng] = latLngOf(site)
    try {
      await api.reports.create({
        category: site.categoryCode,
        lat,
        lng,
        address: site.address,
      })
      setVouchNote('Added to this report')
      load()
    } catch (err) {
      setVouchNote(err instanceof ApiError ? err.message : 'Could not add that')
    }
  }

  const setVerdict = (siteId: string, next: 'fixed' | 'still') =>
    setVerdicts((prev) => {
      const copy = { ...prev }
      if (copy[siteId] === next) delete copy[siteId]
      else copy[siteId] = next
      return copy
    })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The map is the page; the sheet floats over it. */}
      <div className="absolute inset-0">
        <LoopMap
          sites={visible}
          group={category?.group ?? 'roads'}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            if (id) setSheet(2)
          }}
          user={userPoint}
          className="absolute inset-0 z-0"
        />

        {/* Floating chrome: place chip, then the category filters. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] pt-[max(16px,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between px-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,.18)]">
              <LoopMark size={20} />
              <span className="text-[14px] font-bold tracking-[-0.01em]">Miami-Dade</span>
            </div>

            {/* One control for location, where a map's locate button belongs.
                It used to be a decorative chip that only appeared once a fix
                had already been found, with the failure reported as a notice
                down in the corner, so the one state a user could act on was
                the one state with nothing to press. */}
            <button
              onClick={requestLocation}
              aria-label={
                location.status === 'ok'
                  ? 'Your location is on'
                  : location.status === 'locating'
                    ? 'Finding your location'
                    : 'Turn on your location'
              }
              className="press pointer-events-auto flex size-11 items-center justify-center rounded-full bg-surface shadow-[0_2px_10px_rgba(0,0,0,.18)]"
            >
              {location.status === 'locating' ? (
                <span className="animate-loop size-4 rounded-full border-2 border-line border-t-ink" />
              ) : location.status === 'ok' ? (
                <LocateFixed
                  size={19}
                  strokeWidth={2.1}
                  className={userPoint ? 'text-[#2f6bff]' : 'text-ink-3'}
                />
              ) : location.status === 'denied' ? (
                <LocateOff size={19} strokeWidth={2.1} className="text-ink-3" />
              ) : (
                <Locate size={19} strokeWidth={2.1} className="text-ink-3" />
              )}
            </button>
          </div>

          {categories.length > 0 && (
            <div className="no-scrollbar pointer-events-auto mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
              <button
                onClick={() => {
                  setFilters(new Set())
                  setSelectedId(null)
                }}
                className={`press flex h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,.16)] ${
                  filters.size === 0 ? 'bg-ink text-white' : 'bg-surface text-ink'
                }`}
              >
                All
              </button>

              {categories.map((entry) => {
                const on = filters.has(entry.code)
                return (
                  <button
                    key={entry.code}
                    onClick={() => toggle(entry.code)}
                    aria-pressed={on}
                    className={`press flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,.16)] ${
                      on ? 'bg-ink text-white' : 'bg-surface text-ink'
                    }`}
                  >
                    <CategoryIcon group={entry.group} size={14} />
                    {entry.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* One stacked column, so the legend and any notice cannot collide.
            Sits above the bottom strip, which belongs to the map attribution. */}
        <div
          className="pointer-events-none absolute inset-x-4 z-[500] flex flex-col items-start gap-2"
          style={{ bottom: sheetHeight + 12 }}
        >
          <div className="rounded-lg bg-surface/92 px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,.15)]">
            <p className="text-[11px] font-semibold tracking-[0.04em] text-ink-2 uppercase">
              Reports per area
            </p>
            <span
              className="mt-1.5 block h-2 w-24 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg,#ffe08a 0%,#ffb020 40%,#f4722b 70%,#d4342a 100%)',
              }}
            />
            <span className="mt-1 flex w-24 justify-between text-[10px] text-ink-3">
              <span>Fewer</span>
              <span>More</span>
            </span>
          </div>
        </div>

        {/* Reporting is the point of the app, so it stays reachable from the
            map at all times. Right side, clear of the legend column. */}
        <button
          onClick={() => setReportOpen(true)}
          aria-label="Report a problem"
          style={{ bottom: sheetHeight + 12 }}
          className="press absolute right-4 z-[501] flex items-center gap-2 rounded-full bg-ink py-4 pr-5 pl-4 text-white shadow-[0_6px_18px_rgba(0,0,0,.28)]"
        >
          <Plus size={20} strokeWidth={2.6} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Report</span>
        </button>
      </div>

      <BottomSheet index={sheet} onIndexChange={setSheet} onHeightChange={setSheetHeight}>
        {selected ? (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <button
              onClick={() => setSelectedId(null)}
              className="press -ml-1 mb-2 flex h-11 items-center px-1 text-[14px] font-medium text-ink-2"
            >
              Back to all
            </button>

            <SiteBody
              site={selected}
              detail={detail}
              title={titleOf(selected, category)}
              affected={affects.has(selected.id)}
              onAffects={() => toggleAffects(selected)}
              verdict={verdicts[selected.id]}
              onVerdict={(next) => setVerdict(selected.id, next)}
              note={vouchNote}
              canVouch={supports(category, 'submitOutcome')}
              postCount={postsFor(selected.id).length}
              onOpenForum={() => setForumOpen(true)}
            />
          </div>
        ) : (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <div className="flex items-baseline justify-between">
              <h1 className="text-[20px] font-bold tracking-[-0.02em]">
                {userPoint ? 'Closest to you' : 'Most reported'}
              </h1>
              <span className="text-[13px] text-ink-3">{visible.length} shown</span>
            </div>

            <RangePills
              value={range}
              onChange={(next) => {
                setRange(next)
                setSelectedId(null)
              }}
              className="mt-2.5"
            />

            {disputeCount > 0 && (
              <button
                onClick={() => {
                  setDisputedOnly((on) => !on)
                  setSelectedId(null)
                }}
                aria-pressed={disputedOnly}
                className={`press mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left ${
                  disputedOnly ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
                }`}
              >
                <ShieldAlert size={15} strokeWidth={2.3} className="shrink-0" />
                <span className="text-[13px] font-semibold">
                  {disputeCount} closed {disputeCount === 1 ? 'case residents' : 'cases residents'}{' '}
                  say are not fixed
                </span>
              </button>
            )}

            {visible.length === 0 && (
              <p className="py-10 text-center text-[15px] text-ink-2">No matches</p>
            )}

            <ul className="mt-1 divide-y divide-line">
              {ranked.map((site) => (
                <li key={site.id}>
                  <ReportRow
                    site={site}
                    title={addressOf(site)}
                    onClick={() => {
                      setSelectedId(site.id)
                      setSheet(2)
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </BottomSheet>

      {forumOpen && selected && (
        <ReportForum
          title={titleOf(selected, category)}
          thumbnail={selected.thumbnails[0]}
          posts={postsFor(selected.id)}
          onPost={(body, parentId) => addPost(selected.id, body, parentId)}
          onVote={votePost}
          votedIds={postVotes}
          onClose={() => setForumOpen(false)}
        />
      )}

      {reportOpen && category && (
        <ReportFlow
          category={category}
          onClose={() => setReportOpen(false)}
          onFiled={(siteId) => {
            setReportOpen(false)
            load().then(() => setSelectedId(siteId))
          }}
        />
      )}
    </div>
  )
}

function SiteBody({
  site,
  detail,
  title,
  affected,
  onAffects,
  verdict,
  onVerdict,
  note,
  canVouch,
  postCount,
  onOpenForum,
}: {
  site: Site
  detail: SiteDetail | null
  title: string
  affected: boolean
  onAffects: () => void
  verdict: 'fixed' | 'still' | undefined
  onVerdict: (next: 'fixed' | 'still') => void
  note: string | null
  /** The outcome endpoint is parked server-side; see the backend's
   *  REMOVED.md. Without it these controls would do nothing, so the registry
   *  decides whether they appear. */
  canVouch: boolean
  postCount: number
  onOpenForum: () => void
}) {
  const photos = site.photos.slice(0, 4)
  // Once someone says it is being dealt with, asking whether it is done is a
  // sensible question; before that it is not.
  const canVerify = canVouch && (site.reportCount > site.openCount || site.status === 'closed')

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {photos.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="h-44 w-[68%] shrink-0 rounded-xl bg-surface-2 object-cover"
            />
          ))}
        </div>
      )}

      <header>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            {site.display.title}
          </p>
          {site.display.caseNumber && (
            <p className="shrink-0 text-[11px] text-ink-3">Case {site.display.caseNumber}</p>
          )}
        </div>
        <h2 className="mt-1 text-[22px] font-bold leading-[1.2] tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 text-[14px] text-ink-2">{addressOf(site)}</p>
        <ReportMeta
          site={site}
          variant="card"
          className="mt-1.5 max-w-full text-[13px] text-ink-3"
        />
      </header>

      <SiteRecord site={site} detail={detail} />

      {detail && <SiteTimeline site={detail} />}

      <div>
        <div className="flex gap-2">
          <button
            onClick={onAffects}
            aria-pressed={affected}
            className={`press flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg text-[15px] font-medium ${
              affected ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
            }`}
          >
            <Users size={17} strokeWidth={2.3} />
            {affected ? 'Affects you too' : 'Affects me too'}
          </button>

          <button
            onClick={onOpenForum}
            className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-surface-2 text-[15px] font-medium"
          >
            <MessageSquareText size={17} strokeWidth={2.2} />
            {postCount > 0 ? postCount : 'Discuss'}
          </button>
        </div>
        {note && <p className="mt-2 text-[13px] text-ink-3">{note}</p>}
      </div>

      {canVerify && (
        <section>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            Been past it lately
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onVerdict('fixed')}
              aria-pressed={verdict === 'fixed'}
              className={`press flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-medium ${
                verdict === 'fixed' ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
              }`}
            >
              <Check size={17} strokeWidth={2.4} />
              Fixed
            </button>
            <button
              onClick={() => onVerdict('still')}
              aria-pressed={verdict === 'still'}
              className={`press flex h-12 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-medium ${
                verdict === 'still' ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
              }`}
            >
              <RotateCw size={17} strokeWidth={2.3} />
              Still there
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
