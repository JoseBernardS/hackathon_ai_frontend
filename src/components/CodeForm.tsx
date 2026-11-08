import { useEffect, useRef, useState, type FormEvent } from 'react'

const RESEND_COOLDOWN = 60 // seconds, enforced server-side too

interface CodeFormProps {
  phone: string
  devCode?: string | null
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onChangeNumber: () => void
  /** Starts the timer immediately, since a code was just sent. */
  startCooldown?: boolean
}

/** Shared 6-digit entry: used by both sign-in and onboarding. */
export function CodeForm({
  phone,
  devCode,
  onVerify,
  onResend,
  onChangeNumber,
  startCooldown = true,
}: CodeFormProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(startCooldown ? RESEND_COOLDOWN : 0)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || code.length !== 6) return
    setBusy(true)
    setError('')
    try {
      await onVerify(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0) return
    setError('')
    try {
      await onResend()
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      // A 429 means the server is still counting down; mirror it either way.
      setCooldown(RESEND_COOLDOWN)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <h1 className="text-center text-[22px] font-bold tracking-[-0.02em]">
        Enter the 6-digit code
      </h1>
      <p className="mt-2 text-center text-[15px] text-ink-2">
        Sent to {phone}.{' '}
        <button type="button" onClick={onChangeNumber} className="underline underline-offset-2">
          Change
        </button>
      </p>

      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ''))
          setError('')
        }}
        placeholder="000000"
        className="mt-6 w-full rounded-lg bg-surface-2 px-4 py-4 text-center text-[28px] font-bold tracking-[0.4em] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ink"
      />

      {devCode && <p className="mt-2 text-[13px] text-ink-3">Dev code: {devCode}</p>}
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={code.length !== 6 || busy}
        className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
      >
        {busy && (
          <span className="animate-loop size-4 rounded-full border-2 border-white/40 border-t-white" />
        )}
        {busy ? 'Verifying' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="press mt-3 h-12 w-full rounded-lg text-[15px] font-medium text-ink disabled:text-ink-3"
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  )
}
