import { useEffect, useState } from 'react'

/**
 * The category registry, fetched from the backend on launch.
 *
 * Nothing here hardcodes a category code, a subtype list or a URL. The server
 * decides what can be reported and where to fetch it from, so enabling a
 * second category is a server-side change that this client picks up for free.
 *
 * The one client-side opinion is which icon to draw, and that is keyed on
 * `group` rather than `code` so a newly enabled category arrives with a
 * sensible icon instead of a blank.
 */

export interface Subtype {
  code: string
  label: string
}

/** The full 311 corpus the category was derived from. Static, and large
 *  enough that its percentiles mean something. */
export interface Baseline {
  reports: number
  open: number
  openRate: number
  duplicates: number
  meanDaysToClose: number
  p25DaysToClose: number
  medianDaysToClose: number
  p75DaysToClose: number
  p90DaysToClose: number
}

/** Live counts of what is in the database right now. Much smaller than
 *  `Baseline`, and not interchangeable with it. */
export interface CategoryStats {
  reports: number
  userReports: number
  sites: number
  openSites: number
}

export interface Category {
  code: string
  label: string
  group: string
  enabled: true
  source: string
  dedupeRadiusMeters: number
  subtypes: Subtype[]
  /** Official turnaround, by the department that owns it. */
  sla: Record<string, string>
  baseline: Baseline
  /** Paths to call for this category. Read them, never build them. */
  endpoints: Record<string, string>
  stats?: CategoryStats
}

/** Seen in the 311 data but not built yet. Shown as a roadmap, not a dead end. */
export interface BacklogCategory {
  code: string
  label: string
  group: string
  enabled: false
  reports2026: number
}

export interface Registry {
  categories: Category[]
  backlog: BacklogCategory[]
}

const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000'

export async function loadRegistry(): Promise<Registry> {
  const res = await fetch(`${BASE_URL}/api/categories?includeBacklog=1`)
  if (!res.ok) throw new Error(`Category registry unavailable (${res.status})`)
  const data = await res.json()
  return {
    categories: data.categories ?? [],
    // Busiest first, which is how the server sorts it.
    backlog: data.backlog ?? [],
  }
}

/**
 * Whether the server advertises an endpoint for this category.
 *
 * The registry is the source of truth for what the backend can do, so a
 * feature whose endpoint is parked hides itself rather than presenting a
 * control that silently does nothing.
 */
export function supports(category: Category | null, name: string): boolean {
  return Boolean(category?.endpoints?.[name])
}

/** One fetch per page load, shared by everything that needs the registry. */
let pending: Promise<Registry> | null = null

export function getRegistry(): Promise<Registry> {
  pending ??= loadRegistry()
  return pending
}

/** The category the app is currently reporting in. With one category enabled
 *  this is that one; the UI reads it rather than naming it. */
export function liveCategory(registry: Registry): Category | undefined {
  return registry.categories[0]
}

/** The live category, once the registry has loaded. Mirrors useUserLocation
 *  in lib/geo.ts: null until known, never throws into render. */
export function useLiveCategory(): Category | null {
  const [category, setCategory] = useState<Category | null>(null)

  useEffect(() => {
    let live = true
    getRegistry()
      .then((registry) => live && setCategory(liveCategory(registry) ?? null))
      .catch(() => live && setCategory(null))
    return () => {
      live = false
    }
  }, [])

  return category
}

/** The whole registry, once loaded. */
export function useRegistry(): Registry | null {
  const [registry, setRegistry] = useState<Registry | null>(null)

  useEffect(() => {
    let live = true
    getRegistry()
      .then((r) => live && setRegistry(r))
      .catch(() => live && setRegistry(null))
    return () => {
      live = false
    }
  }, [])

  return registry
}

/** Whether more than one category is enabled. A row only needs to name the
 *  category when there is a choice of them. */
export function useMultiCategory(): boolean {
  const [many, setMany] = useState(false)

  useEffect(() => {
    let live = true
    getRegistry()
      .then((registry) => live && setMany(registry.categories.length > 1))
      .catch(() => live && setMany(false))
    return () => {
      live = false
    }
  }, [])

  return many
}
