export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

// 54-char string, URFDLB order, 9 per face, row-major (top-left -> bottom-right
// as viewed head-on from outside that face). Matches cubejs's Cube.fromString/asString.
export type FaceletString = string

export interface RGB {
  r: number
  g: number
  b: number
}

export const CUBE_COLORS = ['white', 'red', 'green', 'yellow', 'orange', 'blue'] as const
export type CubeColorName = (typeof CUBE_COLORS)[number]

export interface ScanStepDef {
  id: string
  faceLetter: FaceLetter
  title: string
  instruction: string
}

export interface StickerReading {
  rgb: RGB
  color: CubeColorName
  confidence: number // 0..1, higher = more confident
}

// Exactly 9 readings, row-major (index 0 = top-left, index 4 = center, index 8 = bottom-right)
// in the direct on-screen order captured for that scan step. No mirroring/rotation applied.
export type FaceReading = StickerReading[]

export type CaptureMap = Record<string, FaceReading> // keyed by ScanStepDef.id

export interface ValidationIssue {
  code:
    | 'BAD_LENGTH'
    | 'COLOR_COUNT'
    | 'MISSING_CORNER'
    | 'MISSING_EDGE'
    | 'ORIENTATION_PARITY'
    | 'PERMUTATION_PARITY'
  message: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}
