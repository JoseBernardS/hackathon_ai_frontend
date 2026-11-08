import { useEffect, useState } from 'react'

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
export function useUserLocation(): UserLocation {
  const [state, setState] = useState<UserLocation>({ status: 'locating' })

  useEffect(() => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setState({ status: 'unavailable' })
      return
    }

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
  }, [])

  return state
}
