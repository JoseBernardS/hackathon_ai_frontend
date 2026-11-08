import { ShieldCheck, ShieldAlert, Image, ShieldQuestion } from 'lucide-react'
import type { Proof, ProofGrade } from '../lib/api-client'

/**
 * What a photo could be checked for, and therefore how much the claim counts.
 *
 * The wording stays hedged on purpose: EXIF can be forged, so a verified
 * grade means the photo is consistent with the claim, not that the claim is
 * proven. `proof.label` from the server is the authoritative wording.
 */
const LOOK: Record<ProofGrade, { Icon: typeof ShieldCheck; strong: boolean }> = {
  geo_verified: { Icon: ShieldCheck, strong: true },
  time_verified: { Icon: ShieldCheck, strong: true },
  photo_only: { Icon: Image, strong: false },
  none: { Icon: ShieldQuestion, strong: false },
  geo_mismatch: { Icon: ShieldAlert, strong: false },
  duplicate: { Icon: ShieldAlert, strong: false },
}

export function ProofBadge({ proof, counted }: { proof: Proof; counted?: boolean }) {
  const { Icon, strong } = LOOK[proof.grade] ?? LOOK.none

  return (
    <div
      className={`flex items-start gap-2 rounded-btn px-3 py-2 ${
        strong ? 'bg-ink text-white' : 'bg-surface-2 text-ink'
      }`}
    >
      <Icon size={15} strokeWidth={2.3} className="mt-px shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] leading-snug font-medium">{proof.label}</p>
        {counted === false && (
          <p className="mt-0.5 text-[12px] opacity-80">This one was not counted.</p>
        )}
      </div>
    </div>
  )
}
