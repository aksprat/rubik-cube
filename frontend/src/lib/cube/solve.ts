// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import type { FaceletString } from './types'

let solverReady = false

// Cube.initSolver() builds Kociemba lookup tables and takes a few seconds of
// CPU time. Call once (e.g. on app load) and await before the first solve.
export async function ensureSolverReady(): Promise<void> {
  if (solverReady) return
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      Cube.initSolver()
      solverReady = true
      resolve()
    }, 0)
  })
}

export function solveFast(str: FaceletString): string[] {
  if (!solverReady) {
    throw new Error('Solver not initialized - call ensureSolverReady() first')
  }
  const cube = Cube.fromString(str)
  const solution: string = cube.solve()
  return solution.split(' ').filter(Boolean)
}
