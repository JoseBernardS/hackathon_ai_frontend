declare module 'leaflet.heat' {}

import 'leaflet'

declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }
  interface HeatLayer extends Layer {
    setLatLngs(points: Array<[number, number, number?]>): this
    setOptions(options: HeatLayerOptions): this
  }
  function heatLayer(
    points: Array<[number, number, number?]>,
    options?: HeatLayerOptions,
  ): HeatLayer
}
