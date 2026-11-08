/**
 * The bits of EXIF that matter for a report: where and when the photo was
 * taken.
 *
 * Hand-rolled rather than pulled from a package because only four tags are
 * needed and the format is small. A parser that cannot read a file must say
 * so by returning nulls, never by throwing: a photo with no metadata is the
 * normal case, not an error. Phones and messaging apps strip EXIF routinely,
 * and iOS removes location on share by default.
 *
 * Only JPEG carries EXIF in practice. HEIC and PNG return nothing.
 */

export interface PhotoMeta {
  /** Where the camera says it was, if the photo still carries it. */
  lat: number | null
  lng: number | null
  takenAt: Date | null
}

const EMPTY: PhotoMeta = { lat: null, lng: null, takenAt: null }

const GPS_IFD = 0x8825
const EXIF_IFD = 0x8769
const GPS_LAT_REF = 0x0001
const GPS_LAT = 0x0002
const GPS_LNG_REF = 0x0003
const GPS_LNG = 0x0004
const DATE_TAKEN = 0x9003

/** Degrees, minutes, seconds as three rationals. */
function toDegrees(parts: number[], ref: string): number | null {
  if (parts.length < 3) return null
  const [d, m, s] = parts
  const value = d + m / 60 + s / 3600
  if (!Number.isFinite(value)) return null
  return ref === 'S' || ref === 'W' ? -value : value
}

function parseExifDate(raw: string): Date | null {
  // EXIF writes "YYYY:MM:DD HH:MM:SS", which Date cannot parse directly.
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  const date = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  )
  return Number.isNaN(date.getTime()) ? null : date
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    // EXIF lives near the front, so only the head of the file is read.
    const buffer = await file.slice(0, 256 * 1024).arrayBuffer()
    const view = new DataView(buffer)
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY

    // Walk the JPEG marker segments looking for APP1 "Exif\0\0".
    let offset = 2
    let tiff = -1
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break
      const marker = view.getUint8(offset + 1)
      const size = view.getUint16(offset + 2)
      if (marker === 0xe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
        tiff = offset + 10
        break
      }
      if (size < 2) break
      offset += 2 + size
    }
    if (tiff < 0 || tiff + 8 > view.byteLength) return EMPTY

    const little = view.getUint16(tiff) === 0x4949
    const u16 = (at: number) => view.getUint16(at, little)
    const u32 = (at: number) => view.getUint32(at, little)
    if (u16(tiff + 2) !== 0x002a) return EMPTY

    const readRationals = (at: number, count: number): number[] => {
      const out: number[] = []
      for (let i = 0; i < count; i++) {
        const n = u32(at + i * 8)
        const d = u32(at + i * 8 + 4)
        out.push(d === 0 ? 0 : n / d)
      }
      return out
    }

    const readAscii = (at: number, count: number): string => {
      let out = ''
      for (let i = 0; i < count - 1 && at + i < view.byteLength; i++) {
        out += String.fromCharCode(view.getUint8(at + i))
      }
      return out
    }

    /** Returns the tags of one IFD, resolving values that live elsewhere. */
    const readIfd = (start: number): Map<number, { type: number; count: number; at: number }> => {
      const tags = new Map<number, { type: number; count: number; at: number }>()
      if (start + 2 > view.byteLength) return tags
      const entries = u16(start)
      for (let i = 0; i < entries; i++) {
        const entry = start + 2 + i * 12
        if (entry + 12 > view.byteLength) break
        const tag = u16(entry)
        const type = u16(entry + 2)
        const count = u32(entry + 4)
        // Values over four bytes are stored at an offset from the TIFF header.
        const size = (type === 3 ? 2 : type === 5 || type === 10 ? 8 : 1) * count
        const at = size > 4 ? tiff + u32(entry + 8) : entry + 8
        tags.set(tag, { type, count, at })
      }
      return tags
    }

    const ifd0 = readIfd(tiff + u32(tiff + 4))

    let takenAt: Date | null = null
    const exifPointer = ifd0.get(EXIF_IFD)
    if (exifPointer) {
      const exif = readIfd(tiff + u32(exifPointer.at))
      const taken = exif.get(DATE_TAKEN)
      if (taken) takenAt = parseExifDate(readAscii(taken.at, taken.count))
    }

    let lat: number | null = null
    let lng: number | null = null
    const gpsPointer = ifd0.get(GPS_IFD)
    if (gpsPointer) {
      const gps = readIfd(tiff + u32(gpsPointer.at))
      const latRef = gps.get(GPS_LAT_REF)
      const latVal = gps.get(GPS_LAT)
      const lngRef = gps.get(GPS_LNG_REF)
      const lngVal = gps.get(GPS_LNG)
      if (latRef && latVal && lngRef && lngVal) {
        lat = toDegrees(readRationals(latVal.at, 3), readAscii(latRef.at, 2))
        lng = toDegrees(readRationals(lngVal.at, 3), readAscii(lngRef.at, 2))
      }
    }

    return { lat, lng, takenAt }
  } catch {
    // Unreadable metadata is not a failed report.
    return EMPTY
  }
}

/** Metres between two points. Good enough well under a kilometre. */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}
