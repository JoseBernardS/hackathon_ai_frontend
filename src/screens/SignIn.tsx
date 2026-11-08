import { useState, type FormEvent } from 'react'
import { LoopMark } from '../components/LoopMark'
import { CodeForm } from '../components/CodeForm'
import api, { ApiError, type User } from '../lib/api-client'

interface SignInProps {
  /** The guide routes unknown numbers (404) straight into onboarding. */
  onNeedsOnboarding: (phone: string) => void
  onSignedIn: (user: User) => void
}

export function SignIn({ onNeedsOnboarding, onSignedIn }: SignInProps) {
  const [sent, setSent] = useState(false)
  const [rawPhone, setRawPhone] = useState('')
  const [phone, setPhone] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const digits = rawPhone.replace(/\D/g, '')

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || digits.length < 10) return

    const e164 = api.toE164(rawPhone)
    setBusy(true)
    setError('')
    try {
      const res = await api.login.requestCode(e164)
      setPhone(e164)
      setDevCode(res.devCode ?? null)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onNeedsOnboarding(e164) // no account yet, go create one
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    } finally {
      setBusy(false)
    }
  }

  const verify = async (code: string) => {
    const { user } = await api.login.verify(phone, code)
    onSignedIn(user) // token is already stored
  }

  return (
    <div className="flex h-full justify-center bg-[#f0f0f0]">
      <div className="flex h-full w-full max-w-[430px] flex-col bg-surface px-6">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
          {/* The mark assembles itself on load: the loop closing. */}
          <LoopMark size={108} animateIn />
          <h1 className="mt-6 text-[28px] font-bold tracking-[-0.025em]">Community Loop</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">Report it. Track it. Close the loop.</p>

          <div className="mt-12 w-full">
            {sent ? (
              <CodeForm
                phone={phone}
                devCode={devCode}
                onVerify={verify}
                onResend={() => api.login.requestCode(phone).then(() => undefined)}
                onChangeNumber={() => {
                  setSent(false)
                  setDevCode(null)
                }}
              />
            ) : (
              <form onSubmit={sendCode}>
                <h2 className="text-center text-[22px] font-bold tracking-[-0.02em]">
                  Enter your mobile number
                </h2>

                <div className="mt-5 flex items-center rounded-lg bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-ink">
                  <span className="shrink-0 py-4 pr-3 text-[16px] font-medium text-ink-2">+1</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    value={rawPhone}
                    onChange={(e) => {
                      setRawPhone(e.target.value)
                      setError('')
                    }}
                    placeholder="(555) 000-0000"
                    className="w-full bg-transparent py-4 text-[16px] outline-none placeholder:text-ink-3"
                  />
                </div>

                {/* Showing the normalized number is the only way a wrong country code is catchable */}
                {digits.length >= 10 && (
                  <p className="mt-2 text-center text-[13px] text-ink-3">
                    We&apos;ll text {api.toE164(rawPhone)}
                  </p>
                )}

                {error && (
                  <p role="alert" className="mt-3 text-center text-[14px] text-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={digits.length < 10 || busy}
                  className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
                >
                  {busy && (
                    <span className="animate-loop size-4 rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {busy ? 'Sending' : 'Continue'}
                </button>

                <p className="mt-5 text-center text-[14px] text-ink-2">
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onNeedsOnboarding(digits.length >= 10 ? api.toE164(rawPhone) : '')
                    }
                    className="font-medium text-ink underline underline-offset-2"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="pb-[max(20px,env(safe-area-inset-bottom))] text-center text-[12px] leading-relaxed text-ink-3">
          By continuing you agree to receive a one-time code by SMS. Message and data rates may
          apply.
        </p>
      </div>
    </div>
  )
}
