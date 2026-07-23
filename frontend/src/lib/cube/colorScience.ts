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

// Approximate standard sticker colors, used as seed centroids. Refined per-scan
// by a couple of k-means-style recentering passes so the classifier adapts to the
// user's actual lighting/cube rather than relying on these being exactly right.
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

// Classifies a full batch of sticker samples (all 54 for a 3x3 scan) at once,
// exploiting the known constraint that each color must appear exactly `perColor`
// times (9 for a 3x3). This is what resolves the classic red/orange ambiguity:
// rather than trusting a single per-pixel threshold, ambiguous stickers are
// reassigned relative to each other until every bucket holds exactly `perColor`.
export function classifyAllStickers(samples: RGB[], perColor = 9): ClassifiedSticker[] {
  const labs = samples.map(rgbToLab)
  let centroids: Record<CubeColorName, Lab> = Object.fromEntries(
    CUBE_COLORS.map((c) => [c, rgbToLab(DEFAULT_REFERENCE_RGB[c])])
  ) as Record<CubeColorName, Lab>

  let assignment: CubeColorName[] = []

  // A couple of k-means-style recentering passes, seeded by the default swatches.
  for (let pass = 0; pass < 3; pass++) {
    assignment = labs.map((lab) => {
      let best: CubeColorName = CUBE_COLORS[0]
      let bestDist = Infinity
      for (const color of CUBE_COLORS) {
        const dist = labDistance(lab, centroids[color])
        if (dist < bestDist) {
          bestDist = dist
          best = color
        }
      }
      return best
    })

    const next: Record<CubeColorName, Lab> = {} as Record<CubeColorName, Lab>
    for (const color of CUBE_COLORS) {
      const members = labs.filter((_, i) => assignment[i] === color)
      if (members.length === 0) {
        next[color] = centroids[color]
        continue
      }
      next[color] = {
        l: members.reduce((s, m) => s + m.l, 0) / members.length,
        a: members.reduce((s, m) => s + m.a, 0) / members.length,
        b: members.reduce((s, m) => s + m.b, 0) / members.length,
      }
    }
    centroids = next
  }

  // Greedy balancing so every color ends up with exactly `perColor` members:
  // repeatedly move the least-confidently-assigned sticker out of an overfull
  // bucket into whichever underfull bucket it's closest to.
  const distToCentroid = (i: number, color: CubeColorName) => labDistance(labs[i], centroids[color])

  const countOf = (color: CubeColorName) => assignment.filter((c) => c === color).length

  let guard = 0
  while (guard++ < samples.length * CUBE_COLORS.length) {
    const overfull = CUBE_COLORS.filter((c) => countOf(c) > perColor)
    const underfull = CUBE_COLORS.filter((c) => countOf(c) < perColor)
    if (overfull.length === 0 || underfull.length === 0) break

    let worstIndex = -1
    let worstColor: CubeColorName | null = null
    let worstMargin = Infinity
    for (let i = 0; i < assignment.length; i++) {
      const current = assignment[i]
      if (!overfull.includes(current)) continue
      let bestUnderfull: CubeColorName = underfull[0]
      let bestUnderfullDist = Infinity
      for (const color of underfull) {
        const d = distToCentroid(i, color)
        if (d < bestUnderfullDist) {
          bestUnderfullDist = d
          bestUnderfull = color
        }
      }
      const margin = bestUnderfullDist - distToCentroid(i, current)
      if (margin < worstMargin) {
        worstMargin = margin
        worstIndex = i
        worstColor = bestUnderfull
      }
    }
    if (worstIndex === -1 || worstColor === null) break
    assignment[worstIndex] = worstColor
  }

  return assignment.map((color, i) => {
    const distances = CUBE_COLORS.map((c) => distToCentroid(i, c)).sort((x, y) => x - y)
    const [closest, secondClosest] = distances
    const spread = secondClosest - closest
    const confidence = spread <= 0 ? 0 : Math.min(1, spread / 40)
    return { color, confidence }
  })
}
