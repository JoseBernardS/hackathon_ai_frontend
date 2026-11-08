import { useEffect, useState } from 'react'
import { X, MapPin, Check, TriangleAlert } from 'lucide-react'
import api, { ApiError, type ApiCategory, type NearbyResult, type CreateReportResult } from '../lib/api-client'
import { CaptureCard } from '../components/CaptureCard'
import { LoopMark } from '../components/LoopMark'

type Step = 'locating' | 'duplicate' | 'form' | 'sending' | 'done'

interface Position {
  lat: number
  lng: number
  accuracy: number
}

/**
 * Filing a report: where you are, whether it is already known, then the form.
 *
 * The duplicate check runs before the form rather than after submission, and
 * it is the point of the flow. In the 311 data 46% of pothole reports sit
 * within 50m of another one, because nothing ever told people it was already
 * known. Confirming an existing site is offered first and styled as the
 * primary action, since it adds weight to a real pin instead of creating a
 * near-duplicate next to it.
 */
export function ReportFlow({
  category,
  onClose,
  onFiled,
}: {
  category: ApiCategory
  onClose: () => void
  onFiled: (siteId: string) => void
}) {
  const [step, setStep] = useState<Step>('locating')
  const [position, setPosition] = useState<Position | null>(null)
  const [nearby, setNearby] = useState<NearbyResult | null>(null)
  const [subType, setSubType] = useState(category.subtypes[0]?.code ?? '')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [result, setResult] = useState<CreateReportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true

    api
      .getPosition()
      .then(async (pos) => {
        if (!live) return
        if (!api.inMiamiDade(pos)) {
          setError('You are outside Miami-Dade, so this cannot be reported here.')
          setStep('form')
          return
        }
        setPosition(pos)
        try {
          const found = await api.sites.nearby({
            category: category.code,
            lat: pos.lat,
            lng: pos.lng,
          })
          if (!live) return
          setNearby(found)
          setStep(found.duplicateLikely ? 'duplicate' : 'form')
        } catch {
          if (live) setStep('form')
        }
      })
      .catch((err: Error) => {
        if (!live) return
        // Refusal is the common case, and it is fatal here: a report without
        // coordinates cannot be placed on the map.
        setError(err.message)
        setStep('form')
      })

    return () => {
      live = false
    }
  }, [category.code])

  /**
   * Confirming files a report at the same spot. The backend dedupes it into
   * the existing site, so the count moves and the map gains no second pin.
   * A duplicate is still evidence the problem was never fixed.
   */
  const confirmExisting = async () => {
    const existing = nearby?.existingSite
    if (!existing || !position) return
    setStep('sending')
    try {
      await api.reports.create({
        category: category.code,
        lat: position.lat,
        lng: position.lng,
        subType,
        photo: photo ?? undefined,
      })
      onFiled(existing.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that')
      setStep('duplicate')
    }
  }

  const submit = async () => {
    if (!position) return
    setStep('sending')
    try {
      const created = await api.reports.create({
        category: category.code,
        lat: position.lat,
        lng: position.lng,
        subType,
        description: description.trim() || undefined,
        photo: photo ?? undefined,
      })
      setResult(created)
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not file that')
      setStep('form')
    }
  }

  return (
    <div className="absolute inset-0 z-[1000] flex flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">Report a problem</h2>
        <button onClick={onClose} aria-label="Close" className="press text-ink-2">
          <X size={22} strokeWidth={2.2} />
        </button>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {step === 'locating' && (
          <div className="flex flex-col items-center py-16">
            <LoopMark size={64} ghost animateIn />
            <p className="mt-4 text-[15px] text-ink-2">Finding where you are</p>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center py-16">
            <LoopMark size={64} ghost animateIn />
            <p className="mt-4 text-[15px] text-ink-2">Sending</p>
          </div>
        )}

        {step === 'duplicate' && nearby?.existingSite && (
          <div>
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-1.5 text-ink-3">
                <MapPin size={13} strokeWidth={2.3} />
                <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">
                  Already reported
                </span>
              </div>
              <p className="mt-2 text-[17px] leading-snug font-bold">
                {nearby.existingSite.reportCount} people already reported this,{' '}
                {nearby.existingSite.distanceMeters}m away.
              </p>
              <p className="mt-1 text-[13px] text-ink-3">
                {nearby.existingSite.address}
                {nearby.existingSite.daysOpen !== null &&
                  ` · open ${nearby.existingSite.daysOpen} days`}
              </p>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
              Confirming adds weight to that report. Filing a new one creates a second pin a few
              metres away.
            </p>

            <button
              onClick={confirmExisting}
              className="press mt-4 h-12 w-full rounded-lg bg-ink text-[15px] font-medium text-white"
            >
              Confirm it is still there
            </button>
            <button
              onClick={() => setStep('form')}
              className="press mt-2 h-12 w-full rounded-lg bg-surface-2 text-[15px] font-medium"
            >
              Report something else
            </button>
          </div>
        )}

        {step === 'form' && (
          <div>
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
                <TriangleAlert size={15} strokeWidth={2.3} className="mt-px shrink-0" />
                <p className="text-[13px] leading-snug">{error}</p>
              </div>
            )}

            <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              What is it
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {category.subtypes.map((option) => (
                <button
                  key={option.code}
                  onClick={() => setSubType(option.code)}
                  aria-pressed={subType === option.code}
                  className={`press rounded-full px-3 py-2 text-[13px] font-semibold ${
                    subType === option.code ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-5 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              Photo
            </p>
            <p className="mt-1 text-[12px] text-ink-3">
              Taken on the spot, the location in the photo backs up the report.
            </p>
            <div className="mt-2">
              <CaptureCard facing="environment" shape="card" file={photo} onPick={setPhoto} />
            </div>

            <p className="mt-5 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              Anything to add
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="mt-2 w-full resize-none rounded-lg bg-surface-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-ink-3"
            />

            <button
              onClick={submit}
              disabled={!position}
              className="press mt-5 h-12 w-full rounded-lg bg-ink text-[15px] font-medium text-white disabled:opacity-40"
            >
              {position ? 'File this report' : 'Location needed'}
            </button>
          </div>
        )}

        {step === 'done' && result && (
          <div className="py-6">
            <div className="flex flex-col items-center">
              <LoopMark size={76} ghost animateIn />
              <p className="mt-4 text-center text-[20px] leading-snug font-bold tracking-[-0.01em]">
                {result.mergedIntoExistingSite
                  ? `Added to an existing report. ${result.site.reportCount} people have now reported this.`
                  : 'Filed. This is the first report here.'}
              </p>
            </div>

            {result.expectedDaysToClose !== null && (
              <p className="mt-3 text-center text-[14px] text-ink-2">
                Typically fixed in about {Math.round(result.expectedDaysToClose)} days.
              </p>
            )}

            <button
              onClick={() => onFiled(result.site.id)}
              className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[15px] font-medium text-white"
            >
              <Check size={17} strokeWidth={2.4} />
              See it on the map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
