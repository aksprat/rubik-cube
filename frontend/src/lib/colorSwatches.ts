// Display-only hex colors for rendering sticker swatches in the UI. Purely
// cosmetic — has no bearing on the engine's own color classification.
import type { CubeColorName } from './cube/types'

export const SWATCH_HEX: Record<CubeColorName, string> = {
  white: '#f5f5f5',
  yellow: '#ffd500',
  red: '#c41e2b',
  orange: '#ff7f11',
  green: '#00843d',
  blue: '#0051ba',
}
