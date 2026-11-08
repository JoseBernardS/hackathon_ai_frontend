import { useEffect, useState } from 'react'
import { X, TriangleAlert, Check, Sparkles, MapPin } from 'lucide-react'
import api, {
  ApiError,
  type ApiCategory,
  type AnalyzeResult,
  type CreateReportResult,
  type NearbyCandidate,
} from '../lib/api-client'
import { CaptureCard } from '../components/CaptureCard'
import { LoopMark } from '../components/LoopMark'

type Step = 'locating' | 'photo' | 'analysing' | 'review' | 'sending' | 'filed' | 'joined'

interface Position {
  lat: number
  lng: number
}

/**
 * Photograph it, check what the model made of it, then either add weight to
 * something already on the map or file a new report.
 *
 * The draft and the duplicate candidates land on one screen because they
 * answer the same question. Splitting them would ask the resident to describe
 * a problem before being told it is already known.
 *
 * Nothing reaches the county until the file button. `analyze` only creates a
 * draft, which expires in 24 hours if abandoned.
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [draft, setDraft] = useState<AnalyzeResult | null>(null)
  const [filed, setFiled] = useState<CreateReportResult | null>(null)
  const [joined, setJoined] = useState<NearbyCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The resident's edits. Undefined means "keep what the model wrote", which
  // is what the API expects and what makes `aiEdited` meaningful.
  const [subType, setSubType] = useState<string | undefined>()
  const [severity, setSeverity] = useState<number | undefined>()
  const [description, setDescription] = useState<string | undefined>()

  useEffect(() => {
    let live = true
    api
      .getPosition()
      .then((pos) => {
        if (!live) return
        if (!api.inMiamiDade(pos)) {
          setError('You are outside Miami-Dade, so this cannot be reported here.')
          return
        }
        setPosition(pos)
        setStep('photo')
      })
      .catch((err: Error) => {
        if (!live) return
        // A report without coordinates cannot be placed, so this is fatal.
        setError(err.message)
      })
    return () => {
      live = false
    }
  }, [])

  const analyse = async (file: File) => {
    if (!position) return
    setStep('analysing')
    setError(null)
    try {
      const result = await api.reports.analyze({
        category: category.code,
        lat: position.lat,
        lng: position.lng,
        photo: file,
      })
      setDraft(result)
      setStep('review')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read that photo')
      setStep('photo')
    }
  }

  const endorse = async (candidate: NearbyCandidate) => {
    setStep('sending')
    try {
      await api.reports.affectsMe(candidate.siteId)
      setJoined(candidate)
      setStep('joined')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that')
      setStep('review')
    }
  }

  const file = async () => {
    if (!draft) return
    setStep('sending')
    try {
      const result = await api.reports.confirm({
        category: category.code,
        draftId: draft.draftId,
        subType,
        severity,
        description,
        // They were shown candidates and said none of them matched, so the
        // silent distance merge would contradict the answer they just gave.
        forceNewSite: draft.nearby.length > 0 || undefined,
      })
      setFiled(result)
      setStep('filed')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not file that')
      setStep('review')
    }
  }

  const value = {
    subType: subType ?? draft?.proposal.subType ?? '',
    severity: severity ?? draft?.proposal.severity ?? 3,
    description: description ?? draft?.proposal.description ?? '',
  }

  return (
    <div className="absolute inset-0 z-[1000] flex flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">Report a problem</h2>
        <button onClick={onClose} aria-label="Close" className="press flex size-11 items-center justify-center text-ink-2">
          <X size={22} strokeWidth={2.2} />
        </button>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {(step === 'locating' || step === 'analysing' || step === 'sending') && (
          <div className="flex flex-col items-center py-16">
            <LoopMark size={64} ghost animateIn />
            <p className="mt-4 text-[15px] text-ink-2">
              {step === 'locating'
                ? 'Finding where you are'
                : step === 'analysing'
                  ? 'Reading your photo'
                  : 'Sending'}
            </p>
            {step === 'analysing' && (
              <p className="mt-1 text-[13px] text-ink-3">This takes a few seconds</p>
            )}
          </div>
        )}

        {error && step !== 'filed' && step !== 'joined' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
            <TriangleAlert size={15} strokeWidth={2.3} className="mt-px shrink-0" />
            <p className="text-[13px] leading-snug">{error}</p>
          </div>
        )}

        {step === 'photo' && (
          <div>
            <h3 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">
              Take a photo of it
            </h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              Taken on the spot, so the location in the photo backs up the report.
            </p>
            <div className="mt-4">
              <CaptureCard
                facing="environment"
                shape="card"
                file={photo}
                onPick={(f) => {
                  setPhoto(f)
                  if (f) analyse(f)
                }}
              />
            </div>
          </div>
        )}

        {step === 'review' && draft && (
          <div className="space-y-5">
            <img
              src={draft.photo}
              alt=""
              className="h-44 w-full rounded-xl bg-surface-2 object-cover"
            />

            {draft.nearby.length > 0 && (
              <section>
                <h3 className="text-[17px] font-bold tracking-[-0.01em]">Is it one of these?</h3>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  Already reported nearby. Tapping one adds your voice instead of making a second
                  pin.
                </p>

                <ul className="mt-2.5 space-y-2">
                  {draft.nearby.map((candidate) => (
                    <li key={candidate.siteId}>
                      <button
                        onClick={() => endorse(candidate)}
                        className="press flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left"
                      >
                        {candidate.thumbnail ? (
                          <img
                            src={candidate.thumbnail}
                            alt=""
                            className="size-14 shrink-0 rounded-lg bg-surface-2 object-cover"
                          />
                        ) : (
                          <span className="size-14 shrink-0 rounded-lg bg-surface-2" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            {candidate.address}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-ink-3">
                            {candidate.distanceMeters}m away · {candidate.statusLabel}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-ink-3">
                            {candidate.totalVoices}{' '}
                            {candidate.totalVoices === 1 ? 'voice' : 'voices'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="flex items-center gap-1.5">
                <h3 className="text-[17px] font-bold tracking-[-0.01em]">
                  {draft.nearby.length > 0 ? 'No, it is a different one' : 'What you found'}
                </h3>
              </div>

              {draft.ai.available ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
                  <Sparkles size={13} strokeWidth={2.3} />
                  Drafted from your photo. Check it before sending.
                </p>
              ) : (
                <p className="mt-0.5 text-[13px] text-ink-3">
                  {draft.ai.reason ?? 'Fill this in yourself.'}
                </p>
              )}

              {/* The model can be wrong, and blocking a real pothole is worse
                  than one junk report, so this warns and lets them continue. */}
              {!draft.ai.looksLikeCategory && draft.ai.rejectionReason && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
                  <TriangleAlert size={15} strokeWidth={2.3} className="mt-px shrink-0" />
                  <p className="text-[13px] leading-snug">{draft.ai.rejectionReason}</p>
                </div>
              )}

              {draft.ai.available && draft.ai.confidence < 0.6 && draft.ai.looksLikeCategory && (
                <p className="mt-2 text-[13px] font-semibold">Please check this before sending.</p>
              )}

              <p className="mt-4 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                What is it
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.subtypeOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => setSubType(option.code)}
                    aria-pressed={value.subType === option.code}
                    className={`press flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold ${
                      value.subType === option.code ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                How bad is it
              </p>
              <div className="mt-2 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setSeverity(level)}
                    aria-pressed={value.severity === level}
                    aria-label={`Severity ${level} of 5`}
                    className={`press h-11 flex-1 rounded-lg text-[15px] font-bold ${
                      value.severity === level ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                Description
              </p>
              <textarea
                value={value.description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-lg bg-surface-2 px-3.5 py-3 text-[15px] outline-none"
              />

              <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
                Filing puts your name, email and phone on a public county case.
              </p>

              <button
                onClick={file}
                className="press mt-3 h-12 w-full rounded-lg bg-ink text-[15px] font-medium text-white"
              >
                File this report
              </button>
            </section>
          </div>
        )}

        {step === 'joined' && joined && (
          <div className="py-6">
            <div className="flex flex-col items-center">
              <LoopMark size={76} ghost animateIn />
              <p className="mt-4 text-center text-[20px] leading-snug font-bold tracking-[-0.01em]">
                Your voice was added.
              </p>
              <p className="mt-2 text-center text-[14px] text-ink-2">
                {joined.address} now has {joined.totalVoices + 1} voices behind it. Nothing new was
                filed, so the county sees one case rather than two.
              </p>
            </div>
            <button
              onClick={() => onFiled(joined.siteId)}
              className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[15px] font-medium text-white"
            >
              <MapPin size={17} strokeWidth={2.4} />
              See it on the map
            </button>
          </div>
        )}

        {step === 'filed' && filed && (
          <div className="py-6">
            <div className="flex flex-col items-center">
              <LoopMark size={76} ghost animateIn />
              <p className="mt-4 text-center text-[20px] leading-snug font-bold tracking-[-0.01em]">
                {filed.mergedIntoExistingSite
                  ? `Added to an existing report. ${filed.site.reportCount} people have now reported this.`
                  : 'Filed. This is the first report here.'}
              </p>
            </div>

            {filed.expectedDaysToClose !== null && (
              <p className="mt-3 text-center text-[14px] text-ink-2">
                Typically fixed in about {Math.round(filed.expectedDaysToClose)} days.
              </p>
            )}

            {filed.filedWith311 && (
              <p className="mt-2 text-center text-[13px] text-ink-3">
                {filed.filedWith311.eligibility?.eligible === false
                  ? (filed.filedWith311.reason ??
                    'This road is not county maintained, so 311 will not take it.')
                  : filed.filedWith311.dryRun
                    ? 'Ready to send to 311.'
                    : filed.filedWith311.caseNumber
                      ? `Sent to 311 as case ${filed.filedWith311.caseNumber}.`
                      : 'Sent to 311.'}
              </p>
            )}

            <button
              onClick={() => onFiled(filed.site.id)}
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
