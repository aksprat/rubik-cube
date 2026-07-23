// Round-trip verification for the cube engine: build a ground-truth cube state
// with cubejs, simulate what the guided capture protocol would read off for that
// physical state, run it through our pipeline, and confirm we recover an
// equivalent, solvable state. Run with: npx tsx scripts/test-cube-engine.ts
// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import { SCAN_SEQUENCE } from '../src/lib/cube/orientation'
import { buildFaceletString } from '../src/lib/cube/orientation'
import { validateFaceletString } from '../src/lib/cube/validation'
import type { CaptureMap, CubeColorName, FaceLetter } from '../src/lib/cube/types'

const LETTER_TO_TEST_COLOR: Record<FaceLetter, CubeColorName> = {
  U: 'white',
  R: 'red',
  F: 'green',
  D: 'yellow',
  L: 'orange',
  B: 'blue',
}

const FACE_SLICE: Record<FaceLetter, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 }

function simulateCapturesFromGroundTruth(groundTruth: string): CaptureMap {
  const captures: CaptureMap = {}
  for (const step of SCAN_SEQUENCE) {
    const start = FACE_SLICE[step.faceLetter]
    const chunk = groundTruth.slice(start, start + 9)
    captures[step.id] = chunk.split('').map((letter) => ({
      rgb: { r: 0, g: 0, b: 0 },
      color: LETTER_TO_TEST_COLOR[letter as FaceLetter],
      confidence: 1,
    }))
  }
  return captures
}

let failures = 0

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`)
  } else {
    failures++
    console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  console.log('Initializing solver (a few seconds)...')
  Cube.initSolver()

  const scrambles = [
    { name: 'solved', moves: '' },
    { name: 'single R', moves: 'R' },
    { name: 'single U', moves: 'U' },
    { name: 'single F', moves: 'F' },
    { name: "R U2 F' L B D2", moves: "R U2 F' L B D2" },
    { name: 'longer scramble', moves: "R U2 F' L B D2 R2 U F L' B' D U' R" },
  ]

  for (const { name, moves } of scrambles) {
    console.log(`\nScramble: ${name} (${moves || 'none'})`)
    const cube = new Cube()
    if (moves) cube.move(moves)
    const groundTruth: string = cube.asString()

    const captures = simulateCapturesFromGroundTruth(groundTruth)
    const rebuilt = buildFaceletString(captures)

    check('rebuilt facelet string matches ground truth', rebuilt === groundTruth, `${rebuilt} vs ${groundTruth}`)

    const validation = validateFaceletString(rebuilt)
    check('validator accepts the rebuilt state', validation.valid, JSON.stringify(validation.issues))

    if (validation.valid) {
      const solveCube = Cube.fromString(rebuilt)
      const solution: string = solveCube.solve()
      solveCube.move(solution)
      check('applying the solve makes the cube solved', solveCube.isSolved(), `solution: ${solution}`)
    }
  }

  console.log('\n--- Negative test: corrupted state should fail validation ---')
  const solved = new Cube()
  const solvedStr: string = solved.asString()
  // Swap two stickers on different faces to break permutation parity.
  const corrupted = solvedStr.slice(0, 9) + 'F' + solvedStr.slice(10, 18) + solvedStr.slice(19)
  const corruptedValidation = validateFaceletString(corrupted)
  check('corrupted state is rejected', !corruptedValidation.valid, JSON.stringify(corruptedValidation.issues))

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
