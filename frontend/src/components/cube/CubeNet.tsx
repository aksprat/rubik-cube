'use client'

// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'
import { SCAN_SEQUENCE } from '@/lib/cube/orientation'
import type { CaptureMap } from '@/lib/cube/types'
import { SWATCH_HEX } from '@/lib/colorSwatches'

export default function CubeNet({ faceletString, moves, completedMoves, captureMap }: {
  faceletString: string; moves: string[]; completedMoves: number; captureMap: CaptureMap
}) {
  const cube = Cube.fromString(faceletString)
  cube.move(moves.slice(0, completedMoves).join(' '))
  const state: string = cube.asString()
  const colors = Object.fromEntries(SCAN_SEQUENCE.map((step) => [step.faceLetter, captureMap[step.id][4].color]))
  return <div className="grid grid-cols-3 gap-3" aria-label={`Cube after ${completedMoves} moves`}>
    {['U', 'R', 'F', 'D', 'L', 'B'].map((face, faceIndex) => <div key={face}>
      <p className="mb-1 text-center text-xs">{face} · {colors[face]} center</p>
      <div className="mx-auto grid max-w-24 grid-cols-3 gap-0.5 bg-zinc-400 p-0.5">
        {state.slice(faceIndex * 9, faceIndex * 9 + 9).split('').map((letter, index) =>
          <div key={index} className="aspect-square" style={{ backgroundColor: SWATCH_HEX[colors[letter]] }} aria-label={`${face} sticker ${index + 1}: ${colors[letter]}`} />)}
      </div>
    </div>)}
  </div>
}
