import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface BottomSheetProps {
  /** Visible height as a fraction of the container, smallest first. */
  snapPoints?: number[]
  index: number
  onIndexChange: (index: number) => void
  /** The sheet's visible height in pixels, for anything that must sit above it. */
  onHeightChange?: (px: number) => void
  children: ReactNode
}

/** Past this, a flick decides the direction regardless of where it ended. */
const FLICK_VELOCITY = 0.5 // px per ms

/** Height of the drag strip, which the content sits below. */
const HANDLE_PX = 44

/**
 * A bottom sheet you can actually drag.
 *
 * The handle used to be decorative, which is worse than having none: it
 * invites a gesture the screen ignores. Dragging is deliberately limited to
 * the handle strip so it can never fight the list scrolling inside, and the
 * strip is 44px tall even though the bar drawn in it is 4px, because the
 * target is what the thumb has to find.
 *
 * Release picks a snap point by position, unless the gesture was a flick, in
 * which case direction wins. Matching what a flick means elsewhere on a phone
 * matters more than being precise about where the finger stopped.
 */
export function BottomSheet({
  snapPoints = [0.16, 0.52, 0.92],
  index,
  onIndexChange,
  onHeightChange,
  children,
}: BottomSheetProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [offset, setOffset] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startOffset: number; lastY: number; lastT: number; v: number } | null>(null)

  const snapOffset = useCallback(
    (i: number) => height * (1 - snapPoints[Math.max(0, Math.min(i, snapPoints.length - 1))]),
    [height, snapPoints],
  )

  useEffect(() => {
    const host = hostRef.current?.parentElement
    if (!host) return
    const measure = () => setHeight(host.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const resting = snapOffset(index)
  const current = offset ?? resting

  useEffect(() => {
    if (height > 0) onHeightChange?.(height - current)
  }, [height, current, onHeightChange])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      startY: e.clientY,
      startOffset: current,
      lastY: e.clientY,
      lastT: performance.now(),
      v: 0,
    }
    setOffset(current)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const now = performance.now()
    const dt = now - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = now

    const min = snapOffset(snapPoints.length - 1)
    const max = snapOffset(0)
    setOffset(Math.max(min, Math.min(max, d.startOffset + (e.clientY - d.startY))))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (offset === null) return

    let next: number
    if (Math.abs(d?.v ?? 0) > FLICK_VELOCITY) {
      // Downward drag is a positive velocity, and means a smaller sheet.
      next = (d?.v ?? 0) > 0 ? index - 1 : index + 1
      next = Math.max(0, Math.min(snapPoints.length - 1, next))
    } else {
      let best = 0
      snapPoints.forEach((_, i) => {
        if (Math.abs(snapOffset(i) - offset) < Math.abs(snapOffset(best) - offset)) best = i
      })
      next = best
    }

    setOffset(null)
    onIndexChange(next)
  }

  return (
    <div
      ref={hostRef}
      className="absolute inset-x-0 top-0 z-[600] flex h-full flex-col overscroll-contain rounded-t-2xl bg-surface shadow-e2"
      style={{
        transform: `translateY(${current}px)`,
        transition: offset === null ? 'transform 320ms cubic-bezier(0.32,0.72,0,1)' : 'none',
      }}
    >
      {/* The whole strip is the target, not the 4px bar drawn inside it. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="separator"
        aria-label="Resize panel"
        className="flex h-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="h-1 w-10 rounded-full bg-ink-3/40" />
      </div>

      {/*
        The panel is full height and slid down, so its lower half sits past the
        bottom of the screen. Left to fill that box, the scroller believes it
        has room it does not have: nothing scrolls, the overflow is unreachable,
        and the touch chains to the page and rubber-bands instead. Sizing the
        content to the part that is actually on screen is what makes it scroll.
      */}
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{ height: Math.max(0, height - current - HANDLE_PX) }}
      >
        {children}
      </div>
    </div>
  )
}
