import type { CaptureMap, FaceLetter, FaceletString, ScanStepDef } from './types'

// Fixed guided capture protocol. Each step is a single, simple physical action from
// the previous one; face identity comes from POSITION in this sequence, not from
// assuming any particular color scheme. Every step is read directly top-to-bottom,
// left-to-right on screen with no mirroring — verified against cubejs's internal
// facelet/corner/edge adjacency tables (see docs/architecture.md decision log).
export const SCAN_SEQUENCE: ScanStepDef[] = [
  {
    id: 'front',
    faceLetter: 'F',
    title: 'Front face',
    instruction:
      "Hold the cube however feels natural. Note which face is toward you and which face is on top — keep this same top face on top for the next three steps. Line the face toward you up in the grid and capture it.",
  },
  {
    id: 'right',
    faceLetter: 'R',
    title: 'Right face',
    instruction:
      'Turn the cube so the face that was on your right is now facing you (the old front face is now on your left). Keep the same face on top. Capture.',
  },
  {
    id: 'back',
    faceLetter: 'B',
    title: 'Back face',
    instruction:
      'Turn the cube the same way again, so the new right-hand face comes to face you. Keep the same face on top. Capture.',
  },
  {
    id: 'left',
    faceLetter: 'L',
    title: 'Left face',
    instruction: 'Turn the cube the same way one more time. Keep the same face on top. Capture.',
  },
  {
    id: 'up',
    faceLetter: 'U',
    title: 'Top face',
    instruction:
      'Return the cube to its very first position (same front, same top). Now tip the whole cube toward you so the top face falls forward to face the camera — the original front face ends up on the bottom. Capture.',
  },
  {
    id: 'down',
    faceLetter: 'D',
    title: 'Bottom face',
    instruction:
      'Return the cube to its very first position once more. This time tip it away from you (backward) so the bottom face swings up and around to face the camera. Capture.',
  },
]

const FACELET_STRING_ORDER: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B']

const stepByFaceLetter = new Map(SCAN_SEQUENCE.map((step) => [step.faceLetter, step]))

export function isCaptureComplete(captures: CaptureMap): boolean {
  return SCAN_SEQUENCE.every((step) => (captures[step.id]?.length ?? 0) === 9)
}

// Each captured face's center sticker (index 4) defines which physical color
// corresponds to that face's letter, since centers never move on a 3x3.
export function deriveColorToLetterMap(captures: CaptureMap): Record<string, FaceLetter> {
  const map: Record<string, FaceLetter> = {}
  for (const step of SCAN_SEQUENCE) {
    const reading = captures[step.id]
    if (!reading || reading.length !== 9) {
      throw new Error(`Missing capture for face ${step.faceLetter}`)
    }
    map[reading[4].color] = step.faceLetter
  }
  return map
}

export function buildFaceletString(captures: CaptureMap): FaceletString {
  const colorToLetter = deriveColorToLetterMap(captures)
  return FACELET_STRING_ORDER.map((letter) => {
    const step = stepByFaceLetter.get(letter)!
    const reading = captures[step.id]
    if (!reading || reading.length !== 9) {
      throw new Error(`Missing capture for face ${letter}`)
    }
    return reading.map((sticker) => colorToLetter[sticker.color] ?? '?').join('')
  }).join('')
}
