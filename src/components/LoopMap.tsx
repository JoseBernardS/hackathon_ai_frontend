import { useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { latLngOf, pressureOf, type Site } from '../lib/sites'
import { iconForGroup } from './CategoryIcon'
import { MIAMI_DADE_BOUNDS, MIAMI_DADE_CENTRE } from '../lib/geo'

/** Pins closer than this many screen pixels collapse into one cluster. */
const CLUSTER_PX = 72

/** Warm ramp: more pressure reads as hotter. See `pressureOf`. */
const HEAT_GRADIENT = {
  0.0: '#ffe08a',
  0.4: '#ffb020',
  0.7: '#f4722b',
  1.0: '#d4342a',
}

const iconSvg = (group: string, size: number) => {
  const Cmp = iconForGroup(group)
  return renderToStaticMarkup(<Cmp size={size} strokeWidth={2.4} />)
}

/**
 * A single report: the reporter's photo in a ring, with the category badged on
 * it. The photo says what happened, the badge says what kind of thing it is.
 */
function pinHtml(site: Site, selected: boolean, group: string): string {
  // Size carries weight of evidence: 3 reports to 28 in the current data.
  const weight = Math.min(1, (site.reportCount - 3) / 25)
  const base = 38 + Math.round(weight * 16)
  const d = selected ? base + 12 : base
  const badge = selected ? 22 : 19
  const photo = site.thumbnails[0] ?? ''
  // Same scale as the heat beneath it, so a hot blob and a red ring mean the
  // same thing rather than two different gradings of the same place.
  const p = pressureOf(site)
  const ring = p >= 0.75 ? '#d4342a' : p >= 0.5 ? '#f4722b' : '#fff'
  return `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="position:relative;width:${d}px;height:${d}px">
        <img src="${photo}" alt="" loading="lazy"
             style="width:100%;height:100%;object-fit:cover;border-radius:9999px;
                    border:3px solid ${selected ? '#000' : ring};
                    box-shadow:0 2px 8px rgba(0,0,0,.3);background:#e9e9e9" />
        <span style="position:absolute;right:-2px;bottom:-2px;width:${badge}px;height:${badge}px;
                     display:flex;align-items:center;justify-content:center;border-radius:9999px;
                     background:#000;color:#fff;border:2px solid #fff">
          ${iconSvg(group, badge - 8)}
        </span>
      </div>
      <div style="width:2px;height:7px;background:${selected ? '#000' : ring};
                  box-shadow:0 1px 3px rgba(0,0,0,.25)"></div>
    </div>`
}

/** Several sites sharing a spot: one bubble, the count, the top category. */
function clusterHtml(members: Site[], group: string): string {
  const d = members.length >= 20 ? 54 : members.length >= 8 ? 48 : 42
  const top = group
  return `
    <div style="position:relative;width:${d}px;height:${d}px">
      <div style="width:100%;height:100%;border-radius:9999px;background:#fff;border:3px solid #fff;
                  box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;
                  justify-content:center;font:700 15px/1 Inter,sans-serif;color:#000">
        ${members.length}
      </div>
      <span style="position:absolute;right:-2px;bottom:-2px;width:19px;height:19px;display:flex;
                   align-items:center;justify-content:center;border-radius:9999px;background:#000;
                   color:#fff;border:2px solid #fff">${iconSvg(top, 11)}</span>
    </div>`
}

interface LoopMapProps {
  sites: Site[]
  /** Icon group, from the category registry: sites no longer carry it. */
  group: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Device position, when known and inside the service area. */
  user: { lat: number; lng: number; accuracy: number } | null
  className?: string
}

export function LoopMap({ sites, group, selectedId, onSelect, user, className = '' }: LoopMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const heatRef = useRef<L.HeatLayer | null>(null)
  const pinLayerRef = useRef<L.LayerGroup | null>(null)
  const userLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Bumped on pan and zoom so pins re-cluster against the new projection.
  const [version, setVersion] = useState(0)
  const [zoom, setZoom] = useState(12)

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return

    const bounds = L.latLngBounds(MIAMI_DADE_BOUNDS)
    const map = L.map(hostRef.current, {
      center: MIAMI_DADE_CENTRE,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      // Geofence: the view cannot leave Miami-Dade.
      maxBounds: bounds,
      maxBoundsViscosity: 1,
      minZoom: 10,
    })
    map.setMaxBounds(bounds)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', () => onSelectRef.current(null))

    const sync = () => {
      setZoom(map.getZoom())
      setVersion((v) => v + 1)
    }
    map.on('zoomend', sync)
    map.on('moveend', sync)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      heatRef.current = null
      pinLayerRef.current = null
      userLayerRef.current = null
    }
  }, [])

  // Density surface. Stays on at every zoom but recedes once pins separate,
  // so close up it is background context rather than noise.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const points = sites.map((site) => {
      const [lat, lng] = latLngOf(site)
      return [lat, lng, pressureOf(site)] as [number, number, number]
    })
    const minOpacity = zoom >= 15 ? 0.14 : 0.4

    if (heatRef.current) {
      heatRef.current.setLatLngs(points)
      heatRef.current.setOptions({ minOpacity })
      return
    }
    heatRef.current = L.heatLayer(points, {
      radius: 34,
      blur: 24,
      minOpacity,
      max: 1,
      gradient: HEAT_GRADIENT,
    }).addTo(map)
  }, [sites, zoom])

  // Pins, clustered by screen distance so they never pile up.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    pinLayerRef.current?.remove()
    const layer = L.layerGroup().addTo(map)
    pinLayerRef.current = layer

    const visible = sites.filter((s) => map.getBounds().pad(0.2).contains(latLngOf(s)))

    // Bucket by projected pixel grid at the current zoom.
    const cells = new Map<string, Site[]>()
    visible.forEach((report) => {
      const pt = map.project(latLngOf(report), map.getZoom())
      const key = `${Math.floor(pt.x / CLUSTER_PX)}:${Math.floor(pt.y / CLUSTER_PX)}`
      const bucket = cells.get(key)
      if (bucket) bucket.push(report)
      else cells.set(key, [report])
    })

    cells.forEach((members) => {
      // Keep a selected report on its own pin rather than hidden in a cluster.
      const selectedHere = members.find((m) => m.id === selectedId)

      if (members.length === 1 || selectedHere) {
        const report = selectedHere ?? members[0]
        const selected = report.id === selectedId
        const d = selected ? 56 : 44
        L.marker(latLngOf(report), {
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : 0,
          icon: L.divIcon({
            className: '',
            html: pinHtml(report, selected, group),
            iconSize: [d, d + 7],
            iconAnchor: [d / 2, d + 7],
          }),
        })
          .addTo(layer)
          .on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            onSelectRef.current(report.id)
          })
        if (selectedHere && members.length > 1) return
        if (members.length === 1) return
      }

      const rest = selectedHere ? members.filter((m) => m.id !== selectedHere.id) : members
      if (rest.length === 0) return

      const lat = rest.reduce((a, r) => a + latLngOf(r)[0], 0) / rest.length
      const lng = rest.reduce((a, r) => a + latLngOf(r)[1], 0) / rest.length
      const sorted = [...rest].sort((a, b) => b.reportCount - a.reportCount)
      const d = rest.length >= 20 ? 54 : rest.length >= 8 ? 48 : 42

      L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: clusterHtml(sorted, group), iconSize: [d, d], iconAnchor: [d / 2, d / 2] }),
      })
        .addTo(layer)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          // Zoom into the cluster rather than guessing which one they meant.
          map.flyTo([lat, lng], Math.min(map.getZoom() + 2, 18), { duration: 0.5 })
        })
    })
  }, [sites, selectedId, version, zoom])

  // The device position: accuracy halo plus a dot.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    userLayerRef.current?.remove()
    userLayerRef.current = null
    if (!user) return

    userLayerRef.current = L.layerGroup([
      L.circle([user.lat, user.lng], {
        radius: Math.min(user.accuracy, 400),
        stroke: false,
        fillColor: '#2f6bff',
        fillOpacity: 0.14,
      }),
      L.marker([user.lat, user.lng], {
        interactive: false,
        zIndexOffset: 500,
        icon: L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;border-radius:9999px;background:#2f6bff;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }),
    ]).addTo(map)
  }, [user])

  // Ease to whatever is selected.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const site = sites.find((s) => s.id === selectedId)
    if (site) map.panTo(latLngOf(site), { animate: true, duration: 0.4 })
  }, [selectedId, sites])

  return <div ref={hostRef} className={className} />
}
