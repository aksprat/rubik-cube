import assert from 'node:assert/strict'
// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import { buildFaceletString, rotateFace, SCAN_SEQUENCE } from '../src/lib/cube/orientation'
import { findFaceRotations } from '../src/lib/cube/rotationRecovery'
import { validateFaceletString } from '../src/lib/cube/validation'
import { ensureSolverReady, solveFast } from '../src/lib/cube/solve'
import type { CaptureMap, CubeColorName, FaceLetter } from '../src/lib/cube/types'
import { describeMove } from '../src/lib/moves'

const colorMap: Record<FaceLetter, CubeColorName> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' }
const faceOrder = ['U', 'R', 'F', 'D', 'L', 'B']
function captureState(state: string): CaptureMap {
  return Object.fromEntries(SCAN_SEQUENCE.map((step) => [step.id,
    state.slice(faceOrder.indexOf(step.faceLetter) * 9, faceOrder.indexOf(step.faceLetter) * 9 + 9).split('').map((letter) =>
      ({ rgb: { r: 0, g: 0, b: 0 }, color: colorMap[letter as FaceLetter], confidence: 1 })),
  ]))
}

async function main() {
  const solved: string = new Cube().asString()
  const captures = captureState(solved)
  captures.right[4].color = 'green'
  assert.throws(() => buildFaceletString(captures), /different center/)

  const flipped = solved.split('')
  ;[flipped[7], flipped[19]] = [flipped[19], flipped[7]]
  assert.equal(validateFaceletString(flipped.join('')).valid, false)
  const twisted = solved.split('')
  ;[twisted[8], twisted[9], twisted[20]] = [twisted[9], twisted[20], twisted[8]]
  assert.equal(validateFaceletString(twisted.join('')).valid, false)
  const mirrored = solved.split('')
  ;[mirrored[9], mirrored[20]] = [mirrored[20], mirrored[9]]
  assert.equal(validateFaceletString(mirrored.join('')).valid, false)
  assert.equal(validateFaceletString('U'.repeat(54)).valid, false)
  assert.equal(validateFaceletString(solved.slice(1)).valid, false)

  const scramble = new Cube().move("R U2 F' L B D2 R2 U F L' B' D U' R").asString()
  const rotated = captureState(scramble)
  rotated.front = rotateFace(rotated.front)
  rotated.up = rotateFace(rotateFace(rotated.up))
  assert.equal(validateFaceletString(buildFaceletString(rotated)).valid, false)
  const recovered = findFaceRotations(rotated)
  assert.equal(recovered.status, 'unique')
  if (recovered.status === 'unique') assert.equal(buildFaceletString(recovered.captures), scramble)
  assert.equal(findFaceRotations(captureState(flipped.join(''))).status, 'none')
  assert.equal(findFaceRotations(captureState(new Cube().move('R').asString())).status, 'ambiguous')
  assert.deepEqual(rotateFace(rotateFace(rotateFace(rotateFace(rotated.front)))), rotated.front)

  const warmup = ensureSolverReady()
  assert.equal(ensureSolverReady(), warmup)
  await warmup
  assert.deepEqual(solveFast(solved), [])
  assert.throws(() => solveFast(flipped.join('')), /flipped/)
  for (let index = 0; index < 20; index++) {
    const cube = Cube.random()
    const solution = solveFast(cube.asString())
    cube.move(solution.join(' '))
    assert.equal(cube.isSolved(), true)
  }
  assert.match(describeMove("R'"), /right face 90° counterclockwise/)
  assert.match(describeMove('U2'), /top face 180°/)
  console.log('PASS: centers, impossible pieces, rotation recovery, ambiguity, verified solves, move descriptions')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
