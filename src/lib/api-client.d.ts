/**
 * Hand-written types for api-client.js, which is copied verbatim from the
 * backend's examples/ and must never be edited here. Keep this file in step
 * with it: if the client gains a method, add it below rather than reaching
 * around the client with a raw fetch.
 */

export interface User {
  _id: string
  phone: string
  status: string
  displayName?: string
  firstName?: string
  lastName?: string
  email?: string
  selfieKey?: string
  idDocumentKey?: string
  verifiedAt?: string
  lastLoginAt?: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string)
}

export const auth: {
  get(): string | null
  set(token: string): void
  clear(): void
  isSignedIn(): boolean
}

export interface OnboardingDetails {
  phone: string
  displayName?: string
  /** Optional to sign up, but 311 will not take a ticket without them. */
  firstName?: string
  lastName?: string
  email?: string
}

export interface AuthResult {
  token: string
  tokenType: string
  expiresIn: string
  user: User
}

export const onboarding: {
  start(): Promise<{ sessionId: string; status: string }>
  uploadDocuments(
    sessionId: string,
    files: { selfie?: File; idDocument?: File },
  ): Promise<unknown>
  /** The last step: finishes sign-up and stores the token. */
  finish(sessionId: string, details: OnboardingDetails): Promise<AuthResult>
  status(sessionId: string): Promise<unknown>
}

export const login: {
  /** One step, no code. Stores the token on success. */
  withPhone(phone: string): Promise<AuthResult>
}

export const session: {
  me(): Promise<User>
  logout(): Promise<void>
}

// --- categories -------------------------------------------------------------

export interface Subtype {
  code: string
  label: string
}

export interface CategoryBaseline {
  reports: number
  open: number
  openRate: number
  duplicates: number
  meanDaysToClose: number
  p25DaysToClose: number
  medianDaysToClose: number
  p75DaysToClose: number
  p90DaysToClose: number
}

export interface CategoryLiveStats {
  reports: number
  userReports: number
  sites: number
  openSites: number
}

export interface ApiCategory {
  code: string
  label: string
  group: string
  enabled: true
  source: string
  dedupeRadiusMeters: number
  subtypes: Subtype[]
  sla: Record<string, string>
  baseline: CategoryBaseline
  endpoints: Record<string, string>
  stats?: CategoryLiveStats
}

export interface BacklogCategory {
  code: string
  label: string
  group: string
  enabled: false
  reports2026: number
}

export const categories: {
  list(opts?: { includeBacklog?: boolean; stats?: boolean }): Promise<{
    count: number
    categories: ApiCategory[]
    backlogCount?: number
    backlog?: BacklogCategory[]
  }>
  get(code: string): Promise<ApiCategory>
}

// --- sites ------------------------------------------------------------------

export type EffectiveStatus =
  | 'open_unverified'
  | 'open_confirmed'
  | 'fixed_unrecorded'
  | 'closed_unverified'
  | 'fixed_confirmed'
  | 'disputed_closure'
  | 'contested'

export type ProofGrade =
  | 'geo_verified'
  | 'time_verified'
  | 'photo_only'
  | 'none'
  | 'geo_mismatch'
  | 'duplicate'

export interface CountyRecord {
  status: 'open' | 'closed'
  closedAt: string | null
  reportCount: number
  openCount: number
  lastReportedAt: string | null
  department: string | null
  sla: string | null
  daysToClose: number | null
}

export interface PeerRecord {
  observations: number
  stillThere: number
  fixed: number
  totalSubmitted: number
  evidenceWeight: number
  geoVerified: number
  withPhoto: number
  strongestProof: ProofGrade | null
  lastObservedAt: string | null
  verdict: 'still_there' | 'fixed' | 'unknown' | null
}

export interface Reconciliation {
  effectiveStatus: EffectiveStatus
  /** Written for display: render it, do not switch over the state. */
  label: string
  agreement: 'agree' | 'disagree' | 'contested' | 'unknown'
  /** 0..1 weighting from evidence quality and recency, not a probability. */
  confidence: number
  disputed: boolean
  needsVerification: boolean
  evaluatedAt?: string
}

/** Precomputed presentation, so the client makes no status decisions. */
export interface SiteDisplay {
  title: string
  subtitle: string
  statusLabel: string
  /** Colour only. Measured against the county's own target for that road. */
  tone: 'ok' | 'warn' | 'critical' | 'done'
  detail: string
  caseNumber: string | null
  overdue: {
    days: number
    targetDays: number | null
    sla: string | null
    expectedAt: string
  } | null
  action: { kind: 'report_too' | 'report_again'; label: string }
  thumbnail: string | null
}

export interface ApiSite {
  id: string
  categoryCode: string
  /** GeoJSON order: [lng, lat]. */
  location: { type: 'Point'; coordinates: [number, number] }
  /** Only present when the request carried lat/lng. */
  distanceMeters?: number
  status: 'open' | 'closed'
  reportCount: number
  openCount: number
  userReportCount: number
  daysOpen: number | null
  firstReportedAt: string
  lastReportedAt: string
  oldestOpenAt: string | null
  avgDaysToClose: number | null
  /** Null on a report filed without one; `display.subtitle` covers that case. */
  address: string | null
  municipality: string | null
  department: string | null
  sla: string | null
  /** False where the city, not the county, maintains the road. */
  canFileWith311?: boolean
  latestCaseNumber: string | null
  /** Newest first, up to 30. */
  caseNumbers: string[]
  subtypes: string[]
  /** Presigned and short lived: about 15 minutes. */
  photos: string[]
  thumbnails: string[]
  photoKeys: string[]
  thumbKeys: string[]
  display: SiteDisplay
  /** Present on GET /api/sites/:id. Public: no token reads as not endorsed. */
  endorsement?: {
    endorsementCount: number
    totalVoices: number
    youEndorsed: boolean
    endpoint: string
  }
  /**
   * Parked on the server: see the backend's REMOVED.md. Optional rather than
   * removed, so restoring them server-side needs no change here.
   */
  county?: CountyRecord
  peer?: PeerRecord
  reconciliation?: Reconciliation
}

/** The county's own view of a tracked case. Null when no ticket exists. */
export interface SiteProgress {
  caseNumber: string
  status: 'reported' | 'acknowledged' | 'in_progress' | 'fixed' | 'closed_unresolved'
  /** The county's own words, e.g. "Completed" or "No Problem Found". */
  outcome: string | null
  statusBecause: string
  stage: { index: number; code: string; name: string; kind: string; of: number }
  stages: { index: number; code: string; name: string; kind: string }[]
  owner: string | null
  slaTarget: string | null
  sla: {
    expectedAt: string
    metOnTime: boolean | null
    /** Negative when late; null once closed. */
    daysRemaining: number | null
    overdue: boolean
  } | null
  lastUpdatedAt: string | null
  countyPhotos: { url: string; mimeType: string; createdAt: string }[]
  events: {
    at: string
    kind: 'submitted' | 'activity' | 'event' | 'closed' | 'canceled'
    label: string
    caseNumber?: string
    code?: string
    outcome?: string | null
    comment?: string | null
    because?: string
    reason?: string | null
  }[]
  checkedAt: string | null
}

export interface SiteReport {
  id: string
  source: '311' | 'user'
  sourceId: string | null
  subType: string | null
  status: 'open' | 'closed'
  priority?: string
  department?: string
  address?: string
  description?: string
  reportedAt: string
  closedAt?: string | null
  daysToClose?: number | null
  photoKeys?: string[]
}

/** One resident's answer, with whatever they attached to back it. */
export interface VerificationEvidence {
  says: 'fixed' | 'not_fixed'
  by: string
  at: string
  note?: string | null
  photo?: string | null
}

export interface Verification {
  fixedCount: number
  notFixedCount: number
  /** `disputed` is a real answer, not a failure to decide. */
  verdict: 'fixed' | 'not_fixed' | 'disputed' | null
  /** Null when signed out, so the sign-in prompt fires on tap, not on load. */
  yourAnswer: 'fixed' | 'not_fixed' | null
  /** Last three who said fixed. Who voted is never returned, only counts. */
  confirmedBy: string[]
  /** Newest first, up to six. */
  evidence: VerificationEvidence[]
  endpoint: string
}

export interface VerifyResult {
  siteId: string
  yourAnswer: 'fixed' | 'not_fixed'
  changedYourAnswer: boolean
  fixedCount: number
  notFixedCount: number
  verdict: 'fixed' | 'not_fixed' | 'disputed' | null
  countyStatus: string
  photo?: string | null
}

export interface ApiSiteDetail extends ApiSite {
  reports: SiteReport[]
  progress: SiteProgress | null
  /** Present on GET /api/sites/:id. Public; a token also fills `yourAnswer`. */
  verification?: Verification
}

export interface NearbyMatch {
  id: string
  distanceMeters: number
  status: 'open' | 'closed'
  reportCount: number
}

export interface NearbyResult {
  duplicateLikely: boolean
  radiusMeters: number
  existingSite?: {
    id: string
    distanceMeters: number
    reportCount: number
    address: string
    daysOpen: number | null
  }
  matches: NearbyMatch[]
}

export interface ProofChecks {
  hasGps: boolean
  gpsDistanceMeters: number | null
  gpsMatchesSite: boolean
  gpsToleranceMeters: number
  takenAt: string | null
  ageDays: number | null
  timestampPlausible: boolean
  takenAfterCountyClosure: boolean
  camera: string | null
  sha256: string
  isDuplicate: boolean
}

export interface Proof {
  grade: ProofGrade
  weight: number
  /** Display-ready wording for what was and was not verified. */
  label: string
  checks: ProofChecks
}

export interface Outcome {
  id: string
  kind: 'fixed' | 'still_there'
  reporterName: string
  note?: string
  observedAt: string
  origin?: 'seed' | 'user'
  photos: string[]
  thumbnails: string[]
  proof?: Proof
}

export interface OutcomeResult {
  outcome: Outcome
  proof: Proof
  site: {
    county: CountyRecord
    peer: PeerRecord
    reconciliation: Reconciliation
  }
  countedTowardVerdict: boolean
}

export const sites: {
  list(opts?: {
    category?: string
    lat?: number
    lng?: number
    radius?: number
    status?: 'open' | 'closed' | 'all'
    minReports?: number
    limit?: number
  }): Promise<{
    count: number
    dedupe: { category: string; siteRadiusMeters: number; totalSites: number; totalReports: number }
    sites: ApiSite[]
  }>
  nearby(opts: {
    category: string
    lat: number
    lng: number
    radius?: number
  }): Promise<NearbyResult>
  stats(opts: {
    category: string
    lat?: number
    lng?: number
    radius?: number
  }): Promise<Record<string, unknown>>
  hotspots(opts: {
    category: string
    minReports?: number
    limit?: number
    lat?: number
    lng?: number
    radius?: number
    status?: string
  }): Promise<{ sites: ApiSite[] }>
  get(siteId: string): Promise<ApiSiteDetail>
}

// --- reports ----------------------------------------------------------------

export interface CreateReportResult {
  report: {
    id: string
    siteId: string
    source: string
    status: string
    severity?: number
    /** True when the draft came from the model at all. */
    aiAssisted?: boolean
    /** True only if the resident actually changed something. */
    aiEdited?: boolean
    photos: string[]
  }
  site: { id: string; reportCount: number; userReportCount?: number; totalVoices?: number }
  mergedIntoExistingSite: boolean
  distanceToSiteMeters: number | null
  expectedDaysToClose: number | null
  located?: {
    municipality: string | null
    department: string | null
    sla: string | null
    method: 'nearest_311_record' | 'none'
    distanceMeters: number | null
    confident: boolean
  }
  /** The county filing happens in this same call; there is no submit step. */
  filedWith311?: {
    filed: boolean
    /** True while the server is in dry run: say "ready to file", not "filed". */
    dryRun: boolean
    alreadyFiled: boolean
    reason: string | null
    caseNumber: string | null
    eligibility?: {
      eligible: boolean
      municipality?: string | null
      reason?: string
      serviceCode?: string
      street?: string
      maintLabel?: string
      roadOwner?: string
    }
  }
}

/** One open problem already on the map, close enough to be the same thing. */
export interface NearbyCandidate {
  siteId: string
  distanceMeters: number
  reportCount: number
  endorsementCount: number
  /** reportCount + endorsementCount. The number to put on the card. */
  totalVoices: number
  address: string
  statusLabel: string
  thumbnail: string | null
}

export interface AnalyzeResult {
  draftId: string
  expiresInHours: number
  photo: string
  location: { lat: number; lng: number }
  ai: {
    available: boolean
    reason: string | null
    model: string | null
    /** False when the model thinks the photo is not this category. */
    looksLikeCategory: boolean
    confidence: number
    rejectionReason: string | null
  }
  proposal: {
    subType: string
    severity: number
    description: string
    hazards: string[]
  }
  subtypeOptions: Subtype[]
  /** Open problems within 150m, nearest first, at most three. */
  nearby: NearbyCandidate[]
}

export interface AffectsMeResult {
  siteId: string
  endorsed: boolean
  alreadyEndorsed: boolean
  endorsementCount: number
  reportCount: number
  totalVoices: number
}

export const reports: {
  /** Step 1: the photo and where it was taken. Nothing is filed by this. */
  analyze(body: {
    category: string
    lat: number
    lng: number
    address?: string
    photo: File
  }): Promise<AnalyzeResult>

  /** Step 2a: "yes, it is that one". Files nothing; idempotent. */
  affectsMe(siteId: string): Promise<AffectsMeResult>

  /** Step 2b: file the draft. Only send fields the user actually changed. */
  confirm(body: {
    category: string
    draftId: string
    subType?: string
    severity?: number
    description?: string
    address?: string
    joinSiteId?: string
    forceNewSite?: boolean
  }): Promise<CreateReportResult>

  create(body: {
    category: string
    lat: number
    lng: number
    subType?: string
    description?: string
    address?: string
    photo?: File
  }): Promise<CreateReportResult>
  mine(opts?: { category?: string }): Promise<{ reports: SiteReport[] }>
}

// --- helpers ----------------------------------------------------------------

export function toE164(input: string, defaultCountryCode?: string): string

export function getPosition(opts?: {
  timeout?: number
  highAccuracy?: boolean
}): Promise<{ lat: number; lng: number; accuracy: number }>

export function inMiamiDade(point: { lat: number; lng: number }): boolean

declare const api: {
  onboarding: typeof onboarding
  login: typeof login
  session: typeof session
  categories: typeof categories
  sites: typeof sites
  reports: typeof reports
  auth: typeof auth
  toE164: typeof toE164
  getPosition: typeof getPosition
  inMiamiDade: typeof inMiamiDade
}
export default api
