import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_BYTES = 15 * 1024 * 1024 // server cap
const CAMERA_TIMEOUT_MS = 6000

interface CaptureCardProps {
  /** 'user' is the selfie camera, 'environment' the rear one. */
  facing: 'user' | 'environment'
  file: File | null
  onPick: (file: File | null) => void
  /** Circle for faces, ID-1 card ratio for documents. */
  shape: 'circle' | 'card'
}

/**
 * Live camera capture. Falls back to the OS file/camera picker when
 * getUserMedia is unavailable, which includes any origin that isn't
 * localhost or HTTPS, since camera access needs a secure context.
 */
export function CaptureCard({ facing, file, onPick, shape }: CaptureCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

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

  const shoot = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // The preview is mirrored for the selfie camera; un-mirror the saved frame.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)

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
      : 'aspect-[1.586/1] rounded-xl w-full' // ID-1 card ratio

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
            className="size-full object-cover"
            style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-center text-[14px] text-danger">
          {error}
        </p>
      )}

      {/* Exactly one action for the current state. */}
      {file ? (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="press mt-4 h-11 w-full text-[15px] font-medium underline underline-offset-2"
        >
          Retake
        </button>
      ) : fallback ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture={facing}
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="press mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-ink text-[16px] font-medium text-white"
          >
            Take photo
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          className="press mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
        >
          {ready ? 'Take photo' : 'Starting camera'}
        </button>
      )}
    </div>
  )
}
