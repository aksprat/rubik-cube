'use client'

import { useEffect, useRef } from 'react'
import { invertMoves } from '@/lib/moves'

interface TwistyCubeProps {
  solutionMoves: string[]
  className?: string
}

// Renders a live 3D animated cube via cubing/twisty's TwistyPlayer, a web
// component backed by browser-only APIs (WebGL/canvas). Loaded dynamically,
// client-side only, inside an effect.
//
// experimentalSetupAlg is set to the inverse of the solution: applying the
// solution to that setup returns the cube to solved, which is exactly the
// scrambled state this solve started from. That lets us reconstruct the
// pre-solve state from the solution alone, with no separate facelet->alg
// conversion needed.
export default function TwistyCube({ solutionMoves, className }: TwistyCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null
    const container = containerRef.current

    async function mountPlayer() {
      const { TwistyPlayer } = await import('cubing/twisty')
      if (cancelled) return

      const setupAlg = invertMoves(solutionMoves).join(' ')
      const alg = solutionMoves.join(' ')

      player = new TwistyPlayer({
        puzzle: '3x3x3',
        experimentalSetupAlg: setupAlg,
        alg,
        background: 'none',
        controlPanel: 'bottom-row',
      })
      player.style.width = '100%'
      player.style.height = '100%'
      container?.appendChild(player)
    }

    mountPlayer()

    return () => {
      cancelled = true
      if (player && container?.contains(player)) {
        container.removeChild(player)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutionMoves.join(' ')])

  return <div ref={containerRef} className={className ?? 'mx-auto aspect-square w-full max-w-sm'} />
}
