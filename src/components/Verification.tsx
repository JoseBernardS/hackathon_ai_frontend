import { useState } from 'react'
import { Check, X, Camera, Landmark, Users, AlertTriangle } from 'lucide-react'
import { CaptureCard } from './CaptureCard'
import { verifySite, type SiteDetail } from '../lib/sites'
import { ApiError, type Verification as VerificationData } from '../lib/api-client'

const DISAGREE = '#d4342a'

const ago = (iso: string) => {
  const days = Math.round((Date.now() - +new Date(iso)) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 31) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * The one question the county's record cannot answer.
 *
 * A closed 311 case means the agency considers the ticket done, and in the
 * 2026 export 99.3% close with the same outcome, "Inspection Completed",
 * which never says whether anything was repaired. A quarter of them were
 * re-reported at the same spot. Only someone walking past can settle it.
 *
 * The county's claim and the neighbourhood's answer are shown together and
 * never merged. When they disagree, that contradiction is the output: it is
 * the thing a resident can screenshot and send to a commissioner, and the
 * county's own system cannot produce it.
 */
export function Verification({
  site,
  hint,
  onChanged,
}: {
  site: SiteDetail
  /** What the reporting record suggests, shown only until a human answers. */
  hint?: string
  onChanged?: () => void
}) {
  const [state, setState] = useState<VerificationData | undefined>(site.verification)
  const [busy, setBusy] = useState<'fixed' | 'not_fixed' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Proof is offered after the answer, not before it. Asking for a photo up
  // front turns a one-tap answer into a chore, and the count is what makes
  // the contradiction visible. Re-posting replaces, so attaching later is
  // safe and never double-counts.
  const [attaching, setAttaching] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [note, setNote] = useState('')

  if (!state) return null

  const { fixedCount, notFixedCount, verdict, yourAnswer, confirmedBy, evidence } = state
  const answers = fixedCount + notFixedCount
  const withPhotos = evidence.filter((e) => e.photo).length
  const countyClosed = site.status === 'closed' || site.display.tone === 'done'

  const answer = async (fixed: boolean, proof?: { photo?: File; note?: string }) => {
    setBusy(fixed ? 'fixed' : 'not_fixed')
    setError(null)
    try {
      const res = await verifySite(site.id, { fixed, ...proof })
      setState({
        ...state,
        fixedCount: res.fixedCount,
        notFixedCount: res.notFixedCount,
        verdict: res.verdict,
        yourAnswer: res.yourAnswer,
      })
      if (proof) {
        setAttaching(false)
        setPhoto(null)
        setNote('')
      }
      onChanged?.()
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Sign in to answer.'
          : err instanceof ApiError
            ? err.message
            : 'Could not send that',
      )
    } finally {
      setBusy(null)
    }
  }

  const headline =
    verdict === 'not_fixed'
      ? `${notFixedCount} ${notFixedCount === 1 ? 'neighbour says' : 'neighbours say'} it is still there`
      : verdict === 'fixed'
        ? confirmedBy.length > 0
          ? `Confirmed fixed by ${confirmedBy.join(', ')}`
          : 'Neighbours confirm it is fixed'
        : verdict === 'disputed'
          ? `Neighbours disagree: ${fixedCount} say fixed, ${notFixedCount} say not`
          : 'Is it actually fixed?'

  const contradiction = countyClosed && verdict === 'not_fixed'

  return (
    <section className="rounded-xl border border-line p-4">
      {/* The two records, side by side and never merged. Agreement is a quiet
          tick; disagreement is the headline, because that contradiction is
          the thing the county's own system cannot produce. */}
      <div className="flex items-center gap-2">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            contradiction || verdict === 'disputed' ? 'text-white' : 'bg-surface-2 text-ink-2'
          }`}
          style={contradiction || verdict === 'disputed' ? { background: DISAGREE } : undefined}
        >
          {contradiction || verdict === 'disputed' ? (
            <AlertTriangle size={13} strokeWidth={2.6} />
          ) : verdict === 'fixed' ? (
            <Check size={14} strokeWidth={3} />
          ) : (
            <Users size={13} strokeWidth={2.4} />
          )}
        </span>
        <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
          {contradiction
            ? 'County and residents disagree'
            : verdict === 'disputed'
              ? 'Residents disagree'
              : answers > 0
                ? 'Checked by neighbours'
                : 'Not checked yet'}
        </span>
      </div>

      <p
        className="mt-2 text-[18px] leading-snug font-bold tracking-[-0.015em]"
        style={contradiction || verdict === 'disputed' ? { color: DISAGREE } : undefined}
      >
        {headline}
      </p>

      {answers === 0 && hint && <p className="mt-1 text-[13px] leading-snug text-ink-3">{hint}</p>}

      <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
        <div className="flex items-baseline gap-2">
          <dt className="flex w-[74px] shrink-0 items-center gap-1.5 text-[12px] text-ink-3">
            <Landmark size={12} strokeWidth={2.3} />
            County
          </dt>
          <dd className="min-w-0 flex-1 text-[13px] font-medium">{site.display.statusLabel}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="flex w-[74px] shrink-0 items-center gap-1.5 text-[12px] text-ink-3">
            <Users size={12} strokeWidth={2.3} />
            Street
          </dt>
          <dd
            className="min-w-0 flex-1 text-[13px] font-medium"
            style={contradiction || verdict === 'disputed' ? { color: DISAGREE } : undefined}
          >
            {answers === 0
              ? 'Nobody has answered yet'
              : verdict === 'disputed'
                ? `${fixedCount} say fixed, ${notFixedCount} say not`
                : verdict === 'fixed'
                  ? `${fixedCount} of ${answers} say fixed`
                  : `${notFixedCount} of ${answers} say still there`}
            {withPhotos > 0 && (
              <span className="text-ink-3">
                {' '}
                · {withPhotos} with a photo
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => answer(true)}
          disabled={busy !== null}
          aria-pressed={yourAnswer === 'fixed'}
          className={`press flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-medium disabled:opacity-50 ${
            yourAnswer === 'fixed' ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
          }`}
        >
          <Check size={16} strokeWidth={2.4} />
          Yes, fixed
        </button>
        <button
          onClick={() => answer(false)}
          disabled={busy !== null}
          aria-pressed={yourAnswer === 'not_fixed'}
          className={`press flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-medium disabled:opacity-50 ${
            yourAnswer === 'not_fixed' ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
          }`}
        >
          <X size={16} strokeWidth={2.4} />
          No, still there
        </button>
      </div>

      {error && <p className="mt-2 text-[13px] text-ink-2">{error}</p>}

      {/* A photo of the repaired road is the strongest thing a resident can
          offer, so it is one tap from the answer they just gave. */}
      {yourAnswer && !attaching && (
        <button
          onClick={() => setAttaching(true)}
          className="press mt-2 flex h-9 w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-ink-2"
        >
          <Camera size={14} strokeWidth={2.4} />
          Back it up with a photo
        </button>
      )}

      {yourAnswer && attaching && (
        <div className="mt-3 rounded-lg bg-surface-2 p-3">
          <p className="text-[13px] font-semibold">
            Show {yourAnswer === 'fixed' ? 'the repaired road' : 'what is still there'}
          </p>
          <div className="mt-2">
            <CaptureCard
              facing="environment"
              shape="card"
              allowLibrary
              file={photo}
              onPick={setPhoto}
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What can you see? Optional."
            className="mt-2 w-full resize-none rounded-lg bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-3"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                answer(yourAnswer === 'fixed', {
                  photo: photo ?? undefined,
                  note: note.trim() || undefined,
                })
              }
              disabled={busy !== null || (!photo && !note.trim())}
              className="press h-11 flex-1 rounded-lg bg-ink text-[14px] font-medium text-white disabled:opacity-40"
            >
              {busy ? 'Sending' : 'Attach to my answer'}
            </button>
            <button
              onClick={() => {
                setAttaching(false)
                setPhoto(null)
                setNote('')
              }}
              className="press h-11 rounded-lg px-4 text-[14px] font-medium text-ink-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-2.5 border-t border-line pt-3">
          {evidence.map((item, i) => (
            <li key={`${item.by}-${item.at}-${i}`} className="flex gap-3">
              {item.photo ? (
                <img
                  src={item.photo}
                  alt=""
                  loading="lazy"
                  className="size-14 shrink-0 rounded-lg bg-surface-2 object-cover"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
                  <Users size={16} strokeWidth={2.2} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {item.by || 'A neighbour'}
                  <span
                    className="rounded-md px-1.5 py-px text-[11px] font-semibold"
                    style={
                      item.says === 'not_fixed'
                        ? { background: DISAGREE, color: '#fff' }
                        : { background: '#f6f6f6', color: '#545454' }
                    }
                  >
                    {item.says === 'fixed' ? 'fixed' : 'still there'}
                  </span>
                </p>
                {item.note && <p className="mt-0.5 text-[13px] leading-snug">{item.note}</p>}
                <p className="mt-0.5 text-[11px] text-ink-3">{ago(item.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
