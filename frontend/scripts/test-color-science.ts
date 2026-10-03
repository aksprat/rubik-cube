import assert from 'node:assert/strict'
import { classifyAllStickers, classifyRescannedFace, minimumCostAssignment } from '../src/lib/cube/colorScience'
import { CUBE_COLORS, type CubeColorName, type RGB } from '../src/lib/cube/types'
import { sampleGridCells } from '../src/lib/scanCapture'

const references: Record<CubeColorName, RGB> = {
  white: { r: 240, g: 240, b: 240 }, yellow: { r: 255, g: 213, b: 0 },
  red: { r: 183, g: 18, b: 32 }, orange: { r: 255, g: 88, b: 0 },
  green: { r: 0, g: 138, b: 65 }, blue: { r: 0, g: 70, b: 173 },
}

assert.deepEqual(minimumCostAssignment([[1, 2], [2, 100]]), [1, 0])
for (const brightness of [1, 0.65, 0.4]) {
  const samples = CUBE_COLORS.flatMap((color) => Array.from({ length: 9 }, (_, index) => {
    const base = references[color]
    const jitter = index - 4
    return { r: Math.max(0, Math.round(base.r * brightness + jitter)), g: Math.max(0, Math.round(base.g * brightness + jitter)), b: Math.max(0, Math.round(base.b * brightness + jitter)) }
  }))
  const classified = classifyAllStickers(samples, 9, [4, 13, 22, 31, 40, 49])
  classified.forEach((reading, index) => assert.equal(reading.color, CUBE_COLORS[Math.floor(index / 9)], `brightness ${brightness}, index ${index}`))
}

const ambiguous = CUBE_COLORS.flatMap((color) => Array<RGB>(9).fill(references[color]))
ambiguous[9] = references.orange
const balanced = classifyAllStickers(ambiguous)
for (const color of CUBE_COLORS) assert.equal(balanced.filter((entry) => entry.color === color).length, 9)
const forced = balanced.filter((entry, index) => entry.color === 'red' && ambiguous[index] === references.orange)
assert.equal(forced.length, 1)
assert.equal(forced[0].confidence, 0)
const black = classifyAllStickers(Array<RGB>(54).fill({ r: 0, g: 0, b: 0 }), 9, [4, 13, 22, 31, 40, 49])
assert.ok(black.every((entry) => entry.confidence < 0.3))
assert.throws(() => classifyAllStickers([{ r: 0, g: 0, b: 0 }]), /equal number/)
assert.throws(() => classifyAllStickers(ambiguous, 9, [4, 4, 22, 31, 40, 49]), /distinct center/)
assert.deepEqual(classifyRescannedFace([references.red, references.orange], CUBE_COLORS.map((color) => ({ color, rgb: references[color] }))).map((entry) => entry.color), ['red', 'orange'])

const pixels = new Uint8ClampedArray(400 * 4)
for (let pixel = 0; pixel < 400; pixel++) {
  pixels.set(pixel < 120 ? [255, 255, 255, 255] : [180, 20, 30, 255], pixel * 4)
}
const canvas = { width: 180, getContext: () => ({ getImageData: () => ({ data: pixels }) }) } as unknown as HTMLCanvasElement
assert.deepEqual(sampleGridCells(canvas), Array(9).fill({ r: 180, g: 20, b: 30 }))
console.log('PASS: center calibration under exposure changes, optimal assignment, forced-color confidence, median glare rejection')
