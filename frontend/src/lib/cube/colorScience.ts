import { CUBE_COLORS, type CubeColorName, type RGB } from './types'

interface Lab {
  l: number
  a: number
  b: number
}

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function rgbToLab({ r, g, b }: RGB): Lab {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041

  const xn = x / 0.95047
  const yn = y / 1.0
  const zn = z / 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : (t * 903.3 + 16) / 116)
  const fx = f(xn)
  const fy = f(yn)
  const fz = f(zn)

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function labDistance(a: Lab, b: Lab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2)
}

const DEFAULT_REFERENCE_RGB: Record<CubeColorName, RGB> = {
  white: { r: 240, g: 240, b: 240 },
  yellow: { r: 255, g: 213, b: 0 },
  red: { r: 183, g: 18, b: 32 },
  orange: { r: 255, g: 88, b: 0 },
  green: { r: 0, g: 138, b: 65 },
  blue: { r: 0, g: 70, b: 173 },
}

export interface ClassifiedSticker {
  color: CubeColorName
  confidence: number
}

export function quickClassifySingle(rgb: RGB): CubeColorName {
  const lab = rgbToLab(rgb)
  let best: CubeColorName = CUBE_COLORS[0]
  let bestDist = Infinity
  for (const color of CUBE_COLORS) {
    const dist = labDistance(lab, rgbToLab(DEFAULT_REFERENCE_RGB[color]))
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

export function minimumCostAssignment(costs: number[][]): number[] {
  const size = costs.length
  const rowPotential = Array(size + 1).fill(0)
  const columnPotential = Array(size + 1).fill(0)
  const matchedRow = Array(size + 1).fill(0)
  const previousColumn = Array(size + 1).fill(0)
  for (let row = 1; row <= size; row++) {
    matchedRow[0] = row
    let column = 0
    const minimum = Array(size + 1).fill(Infinity)
    const visited = Array(size + 1).fill(false)
    do {
      visited[column] = true
      const currentRow = matchedRow[column]
      let delta = Infinity
      let nextColumn = 0
      for (let candidate = 1; candidate <= size; candidate++) {
        if (visited[candidate]) continue
        const cost = costs[currentRow - 1][candidate - 1] - rowPotential[currentRow] - columnPotential[candidate]
        if (cost < minimum[candidate]) {
          minimum[candidate] = cost
          previousColumn[candidate] = column
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate]
          nextColumn = candidate
        }
      }
      for (let candidate = 0; candidate <= size; candidate++) {
        if (visited[candidate]) {
          rowPotential[matchedRow[candidate]] += delta
          columnPotential[candidate] -= delta
        } else {
          minimum[candidate] -= delta
        }
      }
      column = nextColumn
    } while (matchedRow[column] !== 0)
    do {
      const predecessor = previousColumn[column]
      matchedRow[column] = matchedRow[predecessor]
      column = predecessor
    } while (column !== 0)
  }
  const assignment: number[] = []
  for (let column = 1; column <= size; column++) assignment[matchedRow[column] - 1] = column - 1
  return assignment
}

function classifyAgainstReferences(rgb: RGB, references: Record<CubeColorName, Lab>, assigned?: CubeColorName): ClassifiedSticker {
  const lab = rgbToLab(rgb)
  const ranked = CUBE_COLORS.map((color) => ({ color, distance: labDistance(lab, references[color]) }))
    .sort((first, second) => first.distance - second.distance)
  const color = assigned ?? ranked[0].color
  const chosen = ranked.find((entry) => entry.color === color)!
  const alternative = ranked.find((entry) => entry.color !== color)!
  const margin = Math.max(0, alternative.distance - chosen.distance)
  return { color, confidence: Math.min(1, margin / 30) * Math.max(0, 1 - chosen.distance / 80) }
}

export function classifyAllStickers(samples: RGB[], perColor = 9, centerIndices: number[] = []): ClassifiedSticker[] {
  if (samples.length !== CUBE_COLORS.length * perColor) throw new Error('Expected an equal number of stickers per color')
  const references = Object.fromEntries(CUBE_COLORS.map((color) => [color, rgbToLab(DEFAULT_REFERENCE_RGB[color])])) as Record<CubeColorName, Lab>
  const fixed = new Map<number, ClassifiedSticker>()
  if (centerIndices.length) {
    if (centerIndices.length !== 6 || new Set(centerIndices).size !== 6 ||
      centerIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= samples.length)) {
      throw new Error('Expected six distinct center indices')
    }
    const colors = minimumCostAssignment(centerIndices.map((index) =>
      CUBE_COLORS.map((color) => labDistance(rgbToLab(samples[index]), references[color]))))
    centerIndices.forEach((index, center) => {
      fixed.set(index, classifyAgainstReferences(samples[index], references, CUBE_COLORS[colors[center]]))
    })
    centerIndices.forEach((index, center) => {
      references[CUBE_COLORS[colors[center]]] = rgbToLab(samples[index])
    })
  }
  const remaining = samples.map((_, index) => index).filter((index) => !fixed.has(index))
  const slots = CUBE_COLORS.flatMap((color) => Array<CubeColorName>(perColor - (fixed.size ? 1 : 0)).fill(color))
  const assignment = minimumCostAssignment(remaining.map((index) => slots.map((color) =>
    labDistance(rgbToLab(samples[index]), references[color]))))
  remaining.forEach((index, position) => fixed.set(index, classifyAgainstReferences(samples[index], references, slots[assignment[position]])))
  return samples.map((_, index) => fixed.get(index)!)
}

export function classifyRescannedFace(samples: RGB[], centers: { color: CubeColorName; rgb: RGB }[]): ClassifiedSticker[] {
  const references = Object.fromEntries(CUBE_COLORS.map((color) => [color, rgbToLab(DEFAULT_REFERENCE_RGB[color])])) as Record<CubeColorName, Lab>
  if (new Set(centers.map((center) => center.color)).size === 6) {
    for (const center of centers) references[center.color] = rgbToLab(center.rgb)
  }
  return samples.map((sample) => classifyAgainstReferences(sample, references))
}
