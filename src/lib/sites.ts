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
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bMiami-dade\b/, 'Miami-Dade')
    // Street directions stay as initials rather than becoming words.
    .replace(/\b(Sw|Se|Nw|Ne|N|S|E|W)\b/g, (d) => d.toUpperCase())
}

export function placeOf(site: ApiSite): string {
  return titleCase(site.municipality)
}

/**
 * In a map of one category, every site has the same name for the problem and
 * a different place. The address is what tells them apart, so it is what a
 * list row leads with.
 */
export function addressOf(site: ApiSite): string {
  return titleCase(site.address)
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

/** The rest of the subtypes, for a site that collects more than one. */
export function otherSubtypes(site: ApiSite, category: ApiCategory | null): string[] {
  return site.subtypes
    .slice(1)
    .map((code) => category?.subtypes.find((s) => s.code === code)?.label ?? code)
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

/** The county closed some complaints here and more were filed afterwards. */
export function hasClosedBefore(site: ApiSite): number {
  return Math.max(0, site.reportCount - site.openCount)
}

/** County closed the case, residents say the problem is still there. */
export function isDisputed(site: ApiSite): boolean {
  return site.reconciliation?.disputed ?? false
}

/**
 * Confidence is a weighting, not a probability, so it is shown in words.
 * Two sites with identical evidence differ here purely on recency.
 */
export function confidenceWords(confidence: number): 'weak' | 'moderate' | 'strong' {
  if (confidence < 0.3) return 'weak'
  if (confidence <= 0.7) return 'moderate'
  return 'strong'
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

export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86_400_000))
}

/** Totals per municipality, busiest first. Drives the Community tab. */
export function byMunicipality(sites: ApiSite[]) {
  const totals = new Map<string, { name: string; sites: number; reports: number }>()
  sites.forEach((site) => {
    const name = placeOf(site)
    const row = totals.get(name) ?? { name, sites: 0, reports: 0 }
    row.sites += 1
    row.reports += site.reportCount
    totals.set(name, row)
  })
  return [...totals.values()].sort((a, b) => b.reports - a.reports)
}

// --- service level ----------------------------------------------------------

/**
 * Lateness, as the server measures it.
 *
 * This used to be computed here by converting the county's business-day
 * target into calendar days at five days a week. The server now does it per
 * site against that road's own published target, which matters because a City
 * of Miami pothole has 30 business days and a county one has 90. Reading
 * `display.overdue` keeps one answer instead of two that can disagree.
 */
export function overdueDays(site: ApiSite): number | null {
  return site.display.overdue?.days ?? null
}

export function isOverdue(site: ApiSite): boolean {
  return site.display.overdue !== null
}

/** Colour only, as the server grades it. */
export type Tone = ApiSite['display']['tone']

export function toneOf(site: ApiSite): Tone {
  return site.display.tone
}
