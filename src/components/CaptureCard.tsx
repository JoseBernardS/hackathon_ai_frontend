import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_BYTES = 15 * 1024 * 1024 // server cap
const CAMERA_TIMEOUT_MS = 6000
/** Digital zoom past this is mush, not detail. */
const MAX_ZOOM = 4

interface CaptureCardProps {
  /** 'user' is the selfie camera, 'environment' the rear one. */
  facing: 'user' | 'environment'
  file: File | null
  onPick: (file: File | null) => void
  /** Circle for faces, ID-1 card ratio for documents. */
  shape: 'circle' | 'card'
  /** Offer the photo library as well as the camera. Off for identity
   *  documents, where a photo of a photo defeats the point. */
  allowLibrary?: boolean
}

/**
 * Live camera capture. Falls back to the OS file/camera picker when
 * getUserMedia is unavailable, which includes any origin that isn't
 * localhost or HTTPS, since camera access needs a secure context.
 */
export function CaptureCard({
  facing,
  file,
  onPick,
  shape,
  allowLibrary = false,
}: CaptureCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const pinch = useRef<{ start: number; from: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Digital zoom. Hardware zoom is not exposed on most phones, so the frame
  // is scaled in the preview and cropped to match when the shot is taken.
  const [zoom, setZoom] = useState(1)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  // Hold the camera open only while there's no photo to show.
  useEffect(() => {
    if (file || fallback) {
      stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setFallback(true)
      return
    }

    let active = true

    // If the camera never settles (permission left hanging, device busy) the
    // user would otherwise sit on "Starting camera" forever.
    const giveUp = setTimeout(() => {
      if (active) setFallback(true)
    }, CAMERA_TIMEOUT_MS)

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        clearTimeout(giveUp)
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch(() => {
        clearTimeout(giveUp)
        if (active) setFallback(true)
      })

    return () => {
      active = false
      clearTimeout(giveUp)
      stop()
    }
  }, [facing, file, fallback, stop])

  // Object URLs must be revoked or the blobs leak.
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  /** Pinch to zoom, which is how a camera is expected to behave. The slider
   *  below stays for one-handed use and for pointers that cannot pinch. */
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { start: Math.hypot(a.x - b.x, a.y - b.y), from: zoom }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const spread = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.start
      setZoom(Math.max(1, Math.min(MAX_ZOOM, pinch.current.from * spread)))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const shoot = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    // Crop to whatever the preview is showing, so the saved frame is the
    // frame the user composed rather than the full sensor.
    const sw = video.videoWidth / zoom
    const sh = video.videoHeight / zoom
    const sx = (video.videoWidth - sw) / 2
    const sy = (video.videoHeight - sh) / 2

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // The preview is mirrored for the selfie camera; un-mirror the saved frame.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        if (blob.size > MAX_BYTES) {
          setError('That photo is over 15 MB. Try again.')
          return
        }
        onPick(new File([blob], `${facing}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  const fromFile = (f: File | null) => {
    setError('')
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('That needs to be an image.')
    if (f.size > MAX_BYTES) return setError('That photo is over 15 MB. Try another one.')
    onPick(f)
  }

  const frame =
    shape === 'circle'
      ? 'aspect-square rounded-full max-w-[260px] mx-auto'
      : 'aspect-[1.586/1] rounded-card w-full' // ID-1 card ratio

  return (
    <div>
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-surface-2 ${frame} ${
          file ? '' : 'border-2 border-dashed border-line'
        }`}
      >
        {file && preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : fallback ? (
          <span className="px-6 text-center text-[14px] leading-relaxed text-ink-3">
            Camera unavailable here
          </span>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="size-full touch-none object-cover"
            style={{
              transform: `${facing === 'user' ? 'scaleX(-1) ' : ''}scale(${zoom})`,
              transformOrigin: 'center',
            }}
          />
        )}
      </div>

      {!file && !fallback && ready && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[12px] font-semibold text-ink-3">1x</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-11 flex-1 accent-black"
          />
          <span className="w-8 text-right text-[12px] font-semibold text-ink-3">
            {zoom.toFixed(1)}x
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-center text-[14px] text-danger">
          {error}
        </p>
      )}

      {/* Exactly one action for the current state. */}
      {file ? (
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            onPick(null)
          }}
          className="press mt-4 h-11 w-full text-[15px] font-medium underline underline-offset-2"
        >
          Retake
        </button>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture={facing}
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0] ?? null)}
          />
          {/* No `capture`, so this opens the library rather than the camera. */}
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            onClick={fallback ? () => inputRef.current?.click() : shoot}
            disabled={!fallback && !ready}
            className="press mt-4 flex h-12 w-full items-center justify-center rounded-btn bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
          >
            {fallback || ready ? 'Take photo' : 'Starting camera'}
          </button>

          {allowLibrary && (
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="press mt-2 flex h-12 w-full items-center justify-center rounded-btn bg-surface-2 text-[16px] font-medium"
            >
              Choose from photos
            </button>
          )}
        </>
      )}
    </div>
  )
}
