// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import type { FaceletString } from './types'
import { validateFaceletString } from './validation'

let solverReady = false
let initialization: Promise<void> | null = null

// Cube.initSolver() builds Kociemba lookup tables and takes a few seconds of
// CPU time. Call once (e.g. on app load) and await before the first solve.
export function ensureSolverReady(): Promise<void> {
  if (initialization) return initialization
  initialization = new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        Cube.initSolver()
        solverReady = true
        resolve()
      } catch (error) {
        initialization = null
        reject(error)
      }
    }, 0)
  })
  return initialization
}

export function solveFast(str: FaceletString): string[] {
  const validation = validateFaceletString(str)
  if (!validation.valid) throw new Error(validation.issues.map((issue) => issue.message).join(' '))
  if (!solverReady) {
    throw new Error('Solver not initialized - call ensureSolverReady() first')
  }
  const cube = Cube.fromString(str)
  if (cube.isSolved()) return []
  const solution: string = cube.solve()
  cube.move(solution)
  if (!cube.isSolved()) throw new Error('The solution failed verification')
  return solution.split(' ').filter(Boolean)
}
