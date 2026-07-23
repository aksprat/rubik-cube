// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import type { FaceLetter, FaceletString, ValidationIssue, ValidationResult } from './types'

const FACE_LETTERS: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B']

function permutationParity(perm: number[]): number {
  const n = perm.length
  const visited = new Array(n).fill(false)
  let cycles = 0
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    cycles++
    let j = i
    while (!visited[j]) {
      visited[j] = true
      j = perm[j]
    }
  }
  return (n - cycles) % 2
}

function hasAllValuesOnce(values: (number | undefined)[], expectedCount: number): boolean {
  if (values.some((v) => v === undefined)) return false
  return new Set(values).size === expectedCount
}

// Validates a scanned facelet string is a legal, solvable cube state before it's
// ever handed to the solver. cubejs's own Cube.fromString does NOT validate -
// it silently produces a broken Cube on garbage input - so these checks (sticker
// count, piece existence, orientation parity, permutation parity) are our own,
// matching the standard four-check validation used by every Kociemba implementation.
export function validateFaceletString(str: FaceletString): ValidationResult {
  const issues: ValidationIssue[] = []

  if (str.length !== 54) {
    issues.push({ code: 'BAD_LENGTH', message: `Expected 54 stickers, got ${str.length}.` })
    return { valid: false, issues }
  }

  for (const letter of FACE_LETTERS) {
    const count = str.split('').filter((c) => c === letter).length
    if (count !== 9) {
      issues.push({
        code: 'COLOR_COUNT',
        message: `Expected exactly 9 stickers matching face ${letter}, found ${count}. Recheck the scan for this color.`,
      })
    }
  }
  if (issues.length > 0) return { valid: false, issues }

  const cube = Cube.fromString(str)

  if (!hasAllValuesOnce(cube.cp, 8)) {
    issues.push({
      code: 'MISSING_CORNER',
      message: 'Not all 8 corners could be matched - a corner sticker was likely misread.',
    })
  }
  if (!hasAllValuesOnce(cube.ep, 12)) {
    issues.push({
      code: 'MISSING_EDGE',
      message: 'Not all 12 edges could be matched - an edge sticker was likely misread.',
    })
  }
  if (issues.length > 0) return { valid: false, issues }

  const coSum = (cube.co as number[]).reduce((a, b) => a + b, 0)
  const eoSum = (cube.eo as number[]).reduce((a, b) => a + b, 0)
  if (coSum % 3 !== 0) {
    issues.push({
      code: 'ORIENTATION_PARITY',
      message: 'A corner appears twisted - one corner sticker is likely misread, or two stickers were swapped during scanning.',
    })
  }
  if (eoSum % 2 !== 0) {
    issues.push({
      code: 'ORIENTATION_PARITY',
      message: 'An edge appears flipped - one edge sticker is likely misread, or two stickers were swapped during scanning.',
    })
  }

  const cornerParity = permutationParity(cube.cp as number[])
  const edgeParity = permutationParity(cube.ep as number[])
  if (cornerParity !== edgeParity) {
    issues.push({
      code: 'PERMUTATION_PARITY',
      message: 'Two stickers appear swapped in a way that is impossible on a real cube - recheck the scan, especially any two faces that might have been mixed up.',
    })
  }

  return { valid: issues.length === 0, issues }
}
