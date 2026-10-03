'use client'

import { useEffect, useRef, useState } from 'react'
import type { TwistyPlayer } from 'cubing/twisty'
import { invertMoves } from '@/lib/moves'

interface TwistyCubeProps {
  solutionMoves: string[]
  completedMoves?: number
  className?: string
}

export default function TwistyCube({ solutionMoves, completedMoves, className }: TwistyCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [player, setPlayer] = useState<TwistyPlayer | null>(null)
  const [failed, setFailed] = useState(false)
  const controlled = completedMoves !== undefined

  useEffect(() => {
    let cancelled = false
    let mountedPlayer: TwistyPlayer | null = null
    const container = containerRef.current
    import('cubing/twisty').then(({ TwistyPlayer }) => {
      if (cancelled) return
      mountedPlayer = new TwistyPlayer({
        puzzle: '3x3x3',
        experimentalSetupAlg: invertMoves(solutionMoves).join(' '),
        alg: solutionMoves.join(' '),
        background: 'none',
        controlPanel: controlled ? 'none' : 'bottom-row',
        viewerLink: 'none',
      })
      mountedPlayer.indexer = 'simple'
      mountedPlayer.style.width = '100%'
      mountedPlayer.style.height = '100%'
      container?.appendChild(mountedPlayer)
      setPlayer(mountedPlayer)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      mountedPlayer?.remove()
    }
  }, [solutionMoves, controlled])

  useEffect(() => {
    if (!player || completedMoves === undefined) return
    let cancelled = false
    let frame = 0
    Promise.all([player.experimentalModel.indexer.get(), player.experimentalModel.timestampRequest.get()])
      .then(([indexer, previous]) => {
        if (cancelled) return
        const target = completedMoves === solutionMoves.length
          ? indexer.algDuration() : indexer.indexToMoveStartTimestamp(completedMoves)
        const start = typeof previous === 'number' ? previous : 0
        const started = performance.now()
        const animate = (now: number) => {
          if (cancelled) return
          const progress = Math.min(1, (now - started) / 300)
          player.timestamp = start + (target - start) * progress
          if (progress < 1) frame = requestAnimationFrame(animate)
        }
        frame = requestAnimationFrame(animate)
      }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [player, completedMoves, solutionMoves.length])

  if (failed) return <p className="text-sm text-zinc-500">3D preview unavailable. Follow the colored grids and move instructions below.</p>
  return <div ref={containerRef} className={className ?? 'mx-auto aspect-square w-full max-w-sm'} />
}
