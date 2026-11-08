import { useEffect, useMemo, useState, type CSSProperties } from 'react'

/**
 * The Community Loop mark: tapered arcs around a ring, each with a dot at its
 * thick end, forming a closed loop. It is the shape of the issue lifecycle.
 *
 * The four-arc form is the brand mark, traced from the design mockup
 * (Downloads/Mark only-html/Mark.dc.html). The arcs are generated rather than
 * hard-coded because a loop is not always four stages long: `total` draws the
 * same shape with any number of arcs, and `segments` fills the first N of them
 * so a flow can build the mark as it progresses. Order is clockwise from
 * the top.
 *
 * Geometry measured off the original: every arc rides a centreline of radius
 * 33, sweeps 70 of its 90 degree slot, and tapers from a half-width of 7.5 at
 * the dot to 0.48 at the tip. The quadratic below is a least-squares fit of
 * that taper, accurate to 0.12 units in a 100 unit viewBox.
 */

const CENTRE = 50
const RADIUS = 33
/** Each arc covers this much of its slot; the remainder is the gap. */
const SWEEP_FRACTION = 70 / 90
/** Half-width as a quadratic in (1 - t), t running from dot to tip. */
const TAPER = [3.9601, 3.125, 0.4782]
const TAPER_AT_DOT = TAPER[0] + TAPER[1] + TAPER[2]
const STEPS = 48

export const LOOP_SEGMENTS = 4

function halfWidth(t: number, dot: number): number {
  const u = 1 - t
  return (dot / TAPER_AT_DOT) * (TAPER[0] * u * u + TAPER[1] * u + TAPER[2])
}

/** Bearing is degrees clockwise from the top, matching how stages are read. */
function point(r: number, bearing: number): [number, number] {
  const a = (bearing * Math.PI) / 180
  return [CENTRE + r * Math.sin(a), CENTRE - r * Math.cos(a)]
}

/** Arcs thin out as they multiply, so a six stage loop does not read as a
 *  heavier ring than a four stage one. */
function dotRadius(total: number): number {
  return Math.min(8.4, 7.5 * (4 / total) ** 0.6)
}

function arcPath(startBearing: number, sweep: number, dot: number): string {
  const outer: [number, number][] = []
  const inner: [number, number][] = []
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS
    const bearing = startBearing - sweep * t
    const h = halfWidth(t, dot)
    outer.push(point(RADIUS + h, bearing))
    inner.push(point(RADIUS - h, bearing))
  }
  const xy = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`
  const forward = outer.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xy(p)}`)
  const back = inner.reverse().map((p) => `L ${xy(p)}`)
  return `${forward.join(' ')} ${back.join(' ')} Z`
}

interface Segment {
  d: string
  cx: number
  cy: number
  r: number
}

// Pure in `total`, and a handful of totals recur across the app.
const cache = new Map<number, Segment[]>()

function segmentsFor(total: number): Segment[] {
  const hit = cache.get(total)
  if (hit) return hit
  const spacing = 360 / total
  const sweep = spacing * SWEEP_FRACTION
  const dot = dotRadius(total)
  const built = Array.from({ length: total }, (_, i) => {
    const bearing = i * spacing
    const [cx, cy] = point(RADIUS, bearing)
    return { d: arcPath(bearing, sweep, dot), cx, cy, r: dot }
  })
  cache.set(total, built)
  return built
}

interface LoopMarkProps {
  size?: number
  className?: string
  /** How many arcs the whole loop has. Four is the brand mark. */
  total?: number
  /** How many of them are drawn. Defaults to the whole loop. */
  segments?: number
  /** Draw the undrawn arcs faintly so the finished shape is anticipated. */
  ghost?: boolean
  /** Build the arcs up one by one on mount instead of appearing complete. */
  animateIn?: boolean
  /** Milliseconds between arcs when animating in. */
  stagger?: number
}

export function LoopMark({
  size = 28,
  className = '',
  total = LOOP_SEGMENTS,
  segments,
  ghost = false,
  animateIn = false,
  stagger = 170,
}: LoopMarkProps) {
  const all = useMemo(() => segmentsFor(total), [total])
  const filled = Math.max(0, Math.min(segments ?? total, total))
  const [shown, setShown] = useState(animateIn ? 0 : filled)

  useEffect(() => {
    if (!animateIn) {
      setShown(filled)
      return
    }
    // Lay the arcs down one at a time so the loop visibly closes.
    let drawn = 0
    const id = setInterval(() => {
      drawn += 1
      setShown(drawn)
      if (drawn >= filled) clearInterval(id)
    }, stagger)
    return () => clearInterval(id)
  }, [animateIn, filled, stagger])

  return (
    <svg
      role="img"
      aria-label="Community Loop mark"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    >
      {all.map((seg, i) => {
        const on = i < shown
        // Stagger so the arcs land one after another rather than all at once.
        const delay = animateIn ? '0ms' : `${i * 90}ms`
        return (
          <g
            key={i}
            fill="currentColor"
            style={{
              opacity: on ? 1 : ghost ? 0.12 : 0,
              transform: on ? 'scale(1)' : 'scale(0.82)',
              transformOrigin: '50px 50px',
              transition: `opacity 420ms ease ${delay}, transform 420ms cubic-bezier(0.32,0.72,0,1) ${delay}`,
            }}
          >
            <path d={seg.d} />
            <circle cx={seg.cx} cy={seg.cy} r={seg.r} />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The same arc, swept to an arbitrary angle: progress drawn in the mark's own
 * language rather than as a bar.
 *
 * It holds the mark's width for most of the sweep and tapers over the last
 * stretch, because tapering across 300 degrees reads as a drawing error
 * rather than as a stroke. The dot sits at the start, where the mark puts it.
 */
function gaugePath(sweep: number, dot: number): string {
  const outer: [number, number][] = []
  const inner: [number, number][] = []
  const HOLD = 0.72

  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS
    // Full width until HOLD, then down to a tip.
    const taper = t <= HOLD ? 1 : 1 - 0.92 * ((t - HOLD) / (1 - HOLD))
    const h = dot * taper
    const bearing = sweep * t
    outer.push(point(RADIUS + h, bearing))
    inner.push(point(RADIUS - h, bearing))
  }

  const xy = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`
  const forward = outer.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xy(p)}`)
  const back = inner.reverse().map((p) => `L ${xy(p)}`)
  return `${forward.join(' ')} ${back.join(' ')} Z`
}

export function LoopGauge({
  size = 64,
  progress,
  className = '',
  title,
  style,
}: {
  size?: number
  /** 0..1. Anything over 1 is drawn as a closed ring. */
  progress: number
  className?: string
  title?: string
  style?: CSSProperties
}) {
  const clamped = Math.max(0, Math.min(1, progress))
  // Stop just short of a full turn so the head and tail stay readable.
  const sweep = clamped * 348
  const dot = 7.5

  return (
    <svg
      role="img"
      aria-label={title ?? 'Progress'}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.12} />
      {clamped > 0.01 && (
        <g fill="currentColor">
          <path d={gaugePath(sweep, dot)} />
          <circle cx={point(RADIUS, 0)[0]} cy={point(RADIUS, 0)[1]} r={dot} />
        </g>
      )}
    </svg>
  )
}
