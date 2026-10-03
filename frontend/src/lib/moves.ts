// Standard cube-notation move inversion, used to derive a scrambled "setup"
// alg from a solution: applying invertMoves(solution) to a solved cube
// produces the original scrambled state, since solution undoes it.
export function invertMove(move: string): string {
  if (move.endsWith('2')) return move // 180-degree turns are self-inverse
  if (move.endsWith("'")) return move.slice(0, -1)
  return `${move}'`
}

export function invertMoves(moves: string[]): string[] {
  return [...moves].reverse().map(invertMove)
}

export function describeMove(move: string): string {
  const faces: Record<string, string> = { U: 'top', R: 'right', F: 'front', D: 'bottom', L: 'left', B: 'back' }
  const direction = move.endsWith('2') ? '180° (half a turn)' : move.endsWith("'") ? '90° counterclockwise' : '90° clockwise'
  return `Turn the ${faces[move[0]]} face ${direction}, looking directly at that face.`
}
