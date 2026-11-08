import { useCallback, useEffect, useState } from 'react'

/**
 * Miami-Dade County bounding box, [south, west] to [north, east].
 * This is the service area: the map cannot be panned outside it and reports
 * outside it are rejected.
 */
export const MIAMI_DADE_BOUNDS: [[number, number], [number, number]] = [
  [25.137, -80.874],
  [25.979, -80.118],
]

/** Downtown Miami: the fallback view when we have no fix on the user. */
export const MIAMI_DADE_CENTRE: [number, number] = [25.7743, -80.1937]

export function isInsideServiceArea(lat: number, lng: number): boolean {
  const [[south, west], [north, east]] = MIAMI_DADE_BOUNDS
  return lat >= south && lat <= north && lng >= west && lng <= east
}

export type UserLocation =
  | { status: 'locating' }
  | { status: 'ok'; lat: number; lng: number; accuracy: number; inside: boolean }
  | { status: 'denied' }
  | { status: 'unavailable' }

/**
 * Watches the device location. Like the camera, this needs a secure context,
 * so over plain HTTP on a LAN address it resolves to 'unavailable' and the map
 * just stays on Miami-Dade.
 */
/**
 * The browser's idea of where the user is, plus a way to ask again.
 *
 * Asking once on mount is not enough: the first prompt can be dismissed, the
 * page can load before permission is granted, and a denial leaves the map
 * with no way back. The returned `request` restarts the watch, which is what
 * the locate button calls.
 *
 * A denial is sticky, so re-asking cannot re-prompt; the caller has to say so
 * rather than leave the button looking broken.
 */
export function useUserLocation(): [UserLocation, () => void] {
  const [state, setState] = useState<UserLocation>({ status: 'locating' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setState({ status: 'unavailable' })
      return
    }

    setState({ status: 'locating' })

    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setState({
          status: 'ok',
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          inside: isInsideServiceArea(coords.latitude, coords.longitude),
        })
      },
      (err) => {
        setState({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [attempt])

  const request = useCallback(() => setAttempt((n) => n + 1), [])

  return [state, request]
}
