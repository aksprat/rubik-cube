import { buildFaceletString, rotateFace, SCAN_SEQUENCE } from './orientation'
import type { CaptureMap } from './types'
import { validateFaceletString } from './validation'

export type RotationRecovery =
  | { status: 'unique'; captures: CaptureMap; turns: Record<string, number> }
  | { status: 'none' | 'ambiguous' }

export function findFaceRotations(captures: CaptureMap): RotationRecovery {
  try {
    buildFaceletString(captures)
  } catch {
    return { status: 'none' }
  }
  const variants = SCAN_SEQUENCE.map((step) => {
    const readings = [captures[step.id]]
    for (let turn = 1; turn < 4; turn++) readings.push(rotateFace(readings[turn - 1]))
    return readings
  })
  const states = new Set<string>()
  let result: RotationRecovery = { status: 'none' }
  for (let combination = 0; combination < 4096; combination++) {
    let remaining = combination
    const candidate: CaptureMap = {}
    const turns: Record<string, number> = {}
    SCAN_SEQUENCE.forEach((step, index) => {
      turns[step.id] = remaining % 4
      candidate[step.id] = variants[index][remaining % 4]
      remaining = Math.floor(remaining / 4)
    })
    const state = buildFaceletString(candidate)
    if (states.has(state) || !validateFaceletString(state).valid) continue
    states.add(state)
    if (states.size > 1) return { status: 'ambiguous' }
    result = { status: 'unique', captures: candidate, turns }
  }
  return result
}
