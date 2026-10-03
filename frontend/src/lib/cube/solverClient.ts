export function startSolve(facelets: string): { result: Promise<string[]>; cancel: () => void } {
  const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
  let timeout: ReturnType<typeof setTimeout>
  let rejectResult: (reason: Error) => void
  const stop = () => {
    clearTimeout(timeout)
    worker.terminate()
  }
  const result = new Promise<string[]>((resolve, reject) => {
    rejectResult = reject
    timeout = setTimeout(() => {
      stop()
      reject(new Error('Solving took too long. Please retry or check the scan.'))
    }, 120_000)
    worker.onmessage = (event: MessageEvent<{ moves?: string[]; error?: string }>) => {
      stop()
      if (event.data.error || !Array.isArray(event.data.moves)) {
        reject(new Error(event.data.error ?? 'Invalid solver response'))
      } else {
        resolve(event.data.moves)
      }
    }
    worker.onerror = () => {
      stop()
      reject(new Error('Could not start the solver. Reload the app and try again.'))
    }
    worker.postMessage(facelets)
  })
  return { result, cancel: () => { stop(); rejectResult(new Error('Solve cancelled')) } }
}
