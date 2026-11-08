import { useState, type FormEvent } from 'react'
import { LoopMark } from '../components/LoopMark'
import { CaptureCard } from '../components/CaptureCard'
import { CodeForm } from '../components/CodeForm'
import api, { ApiError, type User } from '../lib/api-client'

type Step = 'selfie' | 'id' | 'phone' | 'code'
const ORDER: Step[] = ['selfie', 'id', 'phone', 'code']

interface OnboardingProps {
  /** Prefilled when sign-in bounced the number with a 404. */
  initialPhone?: string
  onSignedIn: (user: User) => void
  onCancel: () => void
}

export function Onboarding({ initialPhone = '', onSignedIn, onCancel }: OnboardingProps) {
  const [step, setStep] = useState<Step>('selfie')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [idDoc, setIdDoc] = useState<File | null>(null)
  const [rawPhone, setRawPhone] = useState(initialPhone)
  const [phone, setPhone] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const index = ORDER.indexOf(step)

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) {
      setError('That step was out of order. Start again from the top.')
    } else if (err instanceof ApiError && err.status === 413) {
      setError('That photo is over 15 MB. Try a smaller one.')
    } else {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  // Step 1: open a session and send the selfie.
  const submitSelfie = async () => {
    if (!selfie || busy) return
    setBusy(true)
    setError('')
    try {
      let id = sessionId
      if (!id) {
        const started = await api.onboarding.start()
        id = started.sessionId
        setSessionId(id)
      }
      await api.onboarding.uploadDocuments(id, { selfie })
      setStep('id')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  // Step 2: same session, the ID photo.
  const submitId = async () => {
    if (!idDoc || !sessionId || busy) return
    setBusy(true)
    setError('')
    try {
      await api.onboarding.uploadDocuments(sessionId, { idDocument: idDoc })
      setStep('phone')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  // Step 3: phone, normalized to E.164 because the backend rejects anything else.
  const submitPhone = async (e: FormEvent) => {
    e.preventDefault()
    if (!sessionId || busy) return
    const e164 = api.toE164(rawPhone)
    setBusy(true)
    setError('')
    try {
      const res = await api.onboarding.submitPhone(sessionId, e164)
      setPhone(e164)
      setDevCode(res.devCode ?? null)
      setStep('code')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (code: string) => {
    if (!sessionId) throw new Error('Session lost. Start again.')
    const { user } = await api.onboarding.verify(sessionId, code)
    onSignedIn(user) // token is already stored
  }

  const back = () => {
    setError('')
    if (index === 0) {
      onCancel()
      return
    }
    setStep(ORDER[index - 1])
  }

  const nextButton = (label: string, onClick: () => void, enabled: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || busy}
      className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
    >
      {busy && (
        <span className="animate-loop size-4 rounded-full border-2 border-white/40 border-t-white" />
      )}
      {busy ? 'Uploading' : label}
    </button>
  )

  return (
    <div className="flex h-full justify-center bg-[#f0f0f0]">
      <div className="flex h-full w-full max-w-[430px] flex-col bg-surface px-6">
        {/* The mark itself is the progress indicator: one arc per step. */}
        <div className="pt-[max(28px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <button onClick={back} className="press -ml-1 text-[15px] font-medium text-ink-2">
              Back
            </button>
            <span className="text-[13px] text-ink-3">
              {index + 1} of {ORDER.length}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <LoopMark size={84} total={ORDER.length} segments={index + 1} ghost />
            <span className="text-[13px] font-medium tracking-[0.08em] text-ink-3 uppercase">
              Community Loop
            </span>
          </div>
        </div>

        {step === 'selfie' && (
          <div className="flex min-h-0 flex-1 flex-col justify-center pb-16">
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em]">
              Take a selfie
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              This confirms you&apos;re a real person so reports can be trusted.
            </p>
            <div className="mt-7">
              <CaptureCard facing="user" shape="circle" file={selfie} onPick={setSelfie} />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-[14px] text-danger">
                {error}
              </p>
            )}
            {selfie && nextButton('Continue', submitSelfie, true)}
          </div>
        )}

        {step === 'id' && (
          <div className="flex min-h-0 flex-1 flex-col justify-center pb-16">
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em]">
              Photograph your ID
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Driver&apos;s licence or passport. Make sure all four corners are visible.
            </p>
            <div className="mt-7">
              <CaptureCard facing="environment" shape="card" file={idDoc} onPick={setIdDoc} />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-[14px] text-danger">
                {error}
              </p>
            )}
            {idDoc && nextButton('Continue', submitId, true)}
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={submitPhone} className="flex min-h-0 flex-1 flex-col justify-center pb-16">
            <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.03em]">
              Enter your mobile number
            </h1>
            <div className="mt-6 flex items-center rounded-lg bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-ink">
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
            {rawPhone.replace(/\D/g, '').length >= 10 && (
              <p className="mt-2 text-[13px] text-ink-3">We&apos;ll text {api.toE164(rawPhone)}</p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-[14px] text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={rawPhone.replace(/\D/g, '').length < 10 || busy}
              className="press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[16px] font-medium text-white disabled:bg-surface-2 disabled:text-ink-3"
            >
              {busy && (
                <span className="animate-loop size-4 rounded-full border-2 border-white/40 border-t-white" />
              )}
              {busy ? 'Sending' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <div className="flex min-h-0 flex-1 flex-col justify-center pb-16">
            <CodeForm
              phone={phone}
              devCode={devCode}
              onVerify={verify}
              onResend={() => api.onboarding.resend(sessionId!).then(() => undefined)}
              onChangeNumber={() => setStep('phone')}
            />
          </div>
        )}

        <p className="pb-[max(20px,env(safe-area-inset-bottom))] text-[12px] leading-relaxed text-ink-3">
          Your photos verify your identity and are never shown on your reports.
        </p>
      </div>
    </div>
  )
}
