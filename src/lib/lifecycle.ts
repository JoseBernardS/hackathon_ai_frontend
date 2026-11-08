/**
 * The resolution cycle, mapped onto the arcs of the mark.
 *
 * The stages are not invented. Where the county tracks a case it publishes
 * its own ladder, and that is what the mark draws. These four are the
 * fallback for sites with no county ticket, derived from complaint counts.
 *
 * It is a loop, not a line: a case the county closes without repairing the
 * road sends the problem round again rather than ending it.
 */

import type { Site } from './sites'
import type { SiteProgress } from './api-client'

export const LOOP_STAGES = [
  { id: 'reported', label: 'Reported' },
  { id: 'confirmed', label: 'Confirmed by neighbours' },
  { id: 'resolved', label: 'Reported fixed' },
  { id: 'verified', label: 'Fixed and confirmed' },
] as const

export type StageId = (typeof LOOP_STAGES)[number]['id']
export const LOOP_LENGTH = LOOP_STAGES.length

/**
 * Where a site sits on the loop.
 *
 * Prefers the county's own ladder, which it publishes per case and which for
 * potholes is three steps, not four: Submitted, Inspection, Closed. Reading
 * it means the mark draws the county's real workflow rather than a shape
 * invented here. `LoopMark` takes any arc count, so the loop adapts.
 *
 * The list payload carries no `progress`, and some sites have no county
 * ticket at all, so the fallback derives four positions from the complaint
 * counts that are always present.
 */
export interface LoopPosition {
  index: number
  total: number
  label: string
  next: string | null
}

export function loopPosition(site: Site, progress?: SiteProgress | null): LoopPosition {
  if (progress && progress.stages.length > 0) {
    const index = progress.stage.index
    const next = progress.stages[index + 1]
    return {
      index,
      total: progress.stages.length,
      label: progress.stage.name,
      next: next ? next.name : null,
    }
  }

  const closed = site.reportCount - site.openCount
  let index = 0
  if (site.openCount === 0) index = 3
  // "Reported fixed" needs most of them settled. One closure out of twenty is
  // not the problem being fixed.
  else if (closed > site.openCount) index = 2
  else if (site.reportCount > 1) index = 1

  return {
    index,
    total: LOOP_LENGTH,
    label: LOOP_STAGES[index].label,
    next: LOOP_STAGES[index + 1]?.label ?? null,
  }
}
