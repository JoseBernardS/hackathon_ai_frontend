/**
 * The map's data layer: deduplicated problem locations from the backend.
 *
 * A "site" is one place with a problem; many reports collapse into it, which
 * is why the pin count and the report count differ. Nothing here invents a
 * field: anything shown comes from the API or is derived from it in one of
 * the helpers below, so there is one place to look when a number is wrong.
 *
 * Presigned photo URLs expire in about 15 minutes, so sites are re-fetched
 * rather than cached for the life of the session.
 */

import api, {
  type ApiCategory,
  type ApiSite,
  type ApiSiteDetail,
  type EffectiveStatus,
} from './api-client'
import { getRegistry, liveCategory } from './categories'

export type { ApiSite as Site, ApiSiteDetail as SiteDetail, EffectiveStatus }

export interface ListOptions {
  lat?: number
  lng?: number
  radius?: number
  status?: 'open' | 'closed' | 'all'
  minReports?: number
  disputed?: boolean
  limit?: number
}

/** The category the app is reporting in, straight from the registry. */
export async function activeCategory(): Promise<ApiCategory> {
  const registry = await getRegistry()
  const category = liveCategory(registry)
  if (!category) throw new Error('No category is enabled')
  return category
}

export async function listSites(options: ListOptions = {}): Promise<ApiSite[]> {
  const category = await activeCategory()
  const { sites } = await api.sites.list({ category: category.code, ...options })
  return sites
}

export async function getSite(id: string): Promise<ApiSiteDetail> {
  return api.sites.get(id)
}

/** Leaflet wants (lat, lng); the API speaks GeoJSON, which is [lng, lat]. */
export function latLngOf(site: ApiSite): [number, number] {
  return [site.location.coordinates[1], site.location.coordinates[0]]
}

/** The county's records shout; the UI does not. */
function titleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bMiami-dade\b/, 'Miami-Dade')
    // Street directions stay as initials rather than becoming words.
    .replace(/\b(Sw|Se|Nw|Ne|N|S|E|W)\b/g, (d) => d.toUpperCase())
}

/** Empty when the county has no municipality for it, which callers drop. */
export function placeOf(site: ApiSite): string {
  return titleCase(site.municipality)
}

/**
 * In a map of one category, every site has the same name for the problem and
 * a different place. The address is what tells them apart, so it is what a
 * list row leads with.
 */
export function addressOf(site: ApiSite): string {
  // A report filed without an address has neither street nor municipality.
  // The server already words that case in `display.subtitle`, so use its
  // wording rather than inventing a second one here.
  return titleCase(site.address) || site.display.subtitle
}

/**
 * What the problem is, in the server's own words. A site can carry several
 * subtypes because the reports behind it disagree; the first is the one the
 * most recent report used.
 */
export function titleOf(site: ApiSite, category: ApiCategory | null): string {
  if (site.subtypes.length === 0) return category?.label ?? site.display.title
  const labels = site.subtypes.map(
    (code) => category?.subtypes.find((s) => s.code === code)?.label ?? code,
  )
  return labels[0]
}

// --- time windows -----------------------------------------------------------
// Windows are measured against the most recent report, because that is what
// "active in the last month" means for a place rather than for one complaint.

export type Range = '30d' | '90d' | '1y' | 'all'

export const RANGES: { id: Range; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '1y', label: '1 year' },
  { id: 'all', label: 'All' },
]

const RANGE_MS: Record<Exclude<Range, 'all'>, number> = {
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
  '1y': 365 * 86_400_000,
}

export function withinRange(site: ApiSite, range: Range): boolean {
  if (range === 'all') return true
  return Date.now() - +new Date(site.lastReportedAt) <= RANGE_MS[range]
}

// --- derived facts ----------------------------------------------------------

/** County closed the case, residents say the problem is still there. */
export function isDisputed(site: ApiSite): boolean {
  return site.reconciliation?.disputed ?? false
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 31) return plural(days, 'day')
  const months = Math.round(days / 30)
  if (months < 12) return plural(months, 'month')
  return plural(Math.round(months / 12), 'year')
}

// --- map pressure -----------------------------------------------------------

/** The county publishes targets in business days; everything else is calendar. */
const BUSINESS_TO_CALENDAR = 7 / 5

/** Diminishing returns: the 28th report says far less than the 2nd. */
const VOICE_CEILING = 30

function targetDaysOf(site: ApiSite): number {
  const stated = site.display.overdue?.targetDays
  if (stated) return stated
  const match = /(\d+)/.exec(site.sla ?? '')
  // 90 business days is the county default where nothing else is published.
  return match ? Math.round(Number(match[1]) * BUSINESS_TO_CALENDAR) : 126
}

/**
 * How much a place should shout, from 0 to 1.
 *
 * Colouring by report count alone rewards busy streets and hides the real
 * failure: one person reporting a hole that nobody has touched in ten months.
 * Colouring by lateness alone does the opposite, treating a single overdue
 * complaint the same as thirty. Neither is the thing a resident or a
 * commissioner wants to see, so both go in.
 *
 * Delay carries slightly more weight, because being ignored is the civic
 * failure; volume is evidence of how many people it costs. Voices are scaled
 * logarithmically so a busy corridor cannot drown out a neglected one, and a
 * settled site scores zero however loud it once was.
 */
export function pressureOf(site: ApiSite): number {
  if (site.status === 'closed' || site.openCount === 0) return 0

  const target = targetDaysOf(site)
  // 0.5 at the target date, 1 at twice the target.
  const delay = Math.min(1, (site.daysOpen ?? 0) / (target * 2))
  const voices = Math.min(1, Math.log1p(site.reportCount) / Math.log1p(VOICE_CEILING))

  return Math.min(1, 0.55 * delay + 0.45 * voices)
}

// --- is it actually fixed ---------------------------------------------------

export type FixState = 'still-there' | 'likely-fixed' | 'too-soon'

export interface FixSignal {
  state: FixState
  repairedAt: string
  /** Days since the county's most recent closure here. */
  silenceDays: number
  /** The longest this place has ever gone without a complaint. */
  longestQuietDays: number
  /** Complaints filed after that closure. Any at all means it is not fixed. */
  reportsSince: number
}

const DAY = 86_400_000

/**
 * Whether a repair held, judged from the reporting record rather than a vote.
 *
 * A closed case proves only that someone filed paperwork. Asking residents to
 * vote turns it into a popularity contest, and the people who would vote are
 * the ones still angry. The objective signal is already in the data: a hole
 * that is genuinely fixed stops being reported.
 *
 * The test is whether this place has gone quieter than it has ever been. An
 * average interval is useless here, because 311 collects bursts of duplicate
 * calls in the days after a hole appears, which drags any mean or median down
 * to nearly zero. The longest gap the site has ever had is burst-proof and is
 * also the honest bar: silence only means something once it exceeds every
 * lull this place has had before.
 *
 * Null when the county has never closed anything here, because there is no
 * repair to judge.
 */
export function fixSignal(detail: ApiSiteDetail): FixSignal | null {
  const reports = [...detail.reports].sort(
    (a, b) => +new Date(a.reportedAt) - +new Date(b.reportedAt),
  )
  if (reports.length < 2) return null

  const closures = reports.filter((r) => r.closedAt).map((r) => +new Date(r.closedAt as string))
  if (closures.length === 0) return null

  const repaired = Math.max(...closures)
  const times = reports.map((r) => +new Date(r.reportedAt))
  const longestQuietDays = Math.max(...times.slice(1).map((t, i) => (t - times[i]) / DAY))
  const silenceDays = (Date.now() - repaired) / DAY
  const reportsSince = times.filter((t) => t > repaired).length

  return {
    state:
      reportsSince > 0 ? 'still-there' : silenceDays > longestQuietDays ? 'likely-fixed' : 'too-soon',
    repairedAt: new Date(repaired).toISOString(),
    silenceDays: Math.round(silenceDays),
    longestQuietDays: Math.round(longestQuietDays),
    reportsSince,
  }
}
