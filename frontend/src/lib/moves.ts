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
