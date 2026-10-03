import { ensureSolverReady, solveFast } from './solve'

self.onmessage = async (event: MessageEvent<string>) => {
  try {
    await ensureSolverReady()
    self.postMessage({ moves: solveFast(event.data) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not solve this cube' })
  }
}
