export const WATER_SINK_MS = 650
export const WATER_RISE_MS = 800

export const shouldAnimateWater = (brand) => (
  brand?.id === 'swedish-club'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
)
