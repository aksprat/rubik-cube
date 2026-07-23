// Camera-frame sampling helpers for the guided scan flow. This is UI-side
// plumbing that feeds RGB samples into the (untouched) cube engine's color
// classifiers — it does not do any color science itself.
import type { RGB } from './cube/types'

// Small, fixed size for the offscreen sampling canvas. It never needs to be
// large since we only read averaged pixel blocks out of it.
export const SAMPLE_CANVAS_SIZE = 180

// Draws the largest centered square crop of the current video frame onto the
// given canvas, matching the visual crop produced by CSS `object-fit: cover`
// inside a square container. Returns false if the video has no frame yet.
export function drawSquareVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const size = Math.min(vw, vh)
  const sx = (vw - size) / 2
  const sy = (vh - size) / 2

  if (canvas.width !== SAMPLE_CANVAS_SIZE) canvas.width = SAMPLE_CANVAS_SIZE
  if (canvas.height !== SAMPLE_CANVAS_SIZE) canvas.height = SAMPLE_CANVAS_SIZE

  ctx.drawImage(video, sx, sy, size, size, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE)
  return true
}

function averageColorInRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): RGB {
  const { data } = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h))
  let r = 0
  let g = 0
  let b = 0
  const pixelCount = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return {
    r: Math.round(r / pixelCount),
    g: Math.round(g / pixelCount),
    b: Math.round(b / pixelCount),
  }
}

// Samples the 9 grid cells (row-major: index 0 = top-left, index 8 =
// bottom-right) from a canvas that already holds a square frame. Each sample
// averages a small region centered in the cell — well inside the cell's
// edges — to dodge sticker-border bleed and specular glare near the grid
// lines.
export function sampleGridCells(canvas: HTMLCanvasElement): RGB[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const size = canvas.width
  const cell = size / 3
  const roi = cell * 0.34 // ~34% of the cell's edge length, centered

  const samples: RGB[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = cell * (col + 0.5)
      const cy = cell * (row + 0.5)
      const x = Math.max(0, Math.round(cx - roi / 2))
      const y = Math.max(0, Math.round(cy - roi / 2))
      const w = Math.min(size - x, Math.round(roi))
      const h = Math.min(size - y, Math.round(roi))
      samples.push(averageColorInRegion(ctx, x, y, w, h))
    }
  }
  return samples
}
