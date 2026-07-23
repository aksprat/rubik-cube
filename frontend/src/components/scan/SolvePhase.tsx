'use client'

import { useEffect, useRef, useState } from 'react'
import { solveFast } from '@/lib/cube/solve'
import { saveSolveToHistory } from '@/lib/history'
import MoveList from './MoveList'
import TwistyCube from '@/components/cube/TwistyCube'
import CoachChat from '@/components/coach/CoachChat'

interface SolvePhaseProps {
  faceletString: string
  solverReadyPromise: Promise<void>
  scanStartedAt: number
  onStartOver: () => void
}

type SolverStatus = 'warming' | 'ready' | 'error'

const PLAY_INTERVAL_MS = 900

export default function SolvePhase({
  faceletString,
  solverReadyPromise,
  scanStartedAt,
  onStartOver,
}: SolvePhaseProps) {
  const [status, setStatus] = useState<SolverStatus>('warming')
  const [moves, setMoves] = useState<string[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const savedRef = useRef(false)

  useEffect(() => {
    let mounted = true
    solverReadyPromise.then(
      () => {
        if (!mounted) return
        try {
          const result = solveFast(faceletString)
          setMoves(result)
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      },
      () => {
        if (mounted) setStatus('error')
      }
    )
    return () => {
      mounted = false
    }
  }, [faceletString, solverReadyPromise])

  useEffect(() => {
    if (moves && !savedRef.current) {
      savedRef.current = true
      saveSolveToHistory({
        faceletString,
        solutionMoves: moves,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - scanStartedAt,
      })
    }
  }, [moves, faceletString, scanStartedAt])

  const isAtEnd = !!moves && currentIndex >= moves.length - 1

  // Only schedules further ticks while playing and not yet at the end;
  // simply stops scheduling once the end is reached (rather than
  // synchronously flipping isPlaying from inside the effect body — the
  // Play/Pause button instead derives its label from `isAtEnd`).
  useEffect(() => {
    if (!isPlaying || !moves || isAtEnd) return
    const timer = setTimeout(() => {
      setCurrentIndex((i) => Math.min(moves.length - 1, i + 1))
    }, PLAY_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, currentIndex, moves, isAtEnd])

  if (status === 'warming') {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
        Warming up the solver…
      </div>
    )
  }

  if (status === 'error' || !moves) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-red-600">
        <p>Something went wrong computing the solution.</p>
        <button type="button" onClick={onStartOver} className="underline">
          Start over
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your solution ({moves.length} moves)</h2>
        <button type="button" onClick={onStartOver} className="text-sm text-blue-600 underline underline-offset-2">
          Scan another cube
        </button>
      </div>

      <TwistyCube solutionMoves={moves} />

      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex((i) => Math.max(0, i - 1))
            }}
            disabled={currentIndex === 0}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              if (isAtEnd) {
                setCurrentIndex(0)
                setIsPlaying(true)
              } else {
                setIsPlaying((p) => !p)
              }
            }}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isPlaying && !isAtEnd ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex((i) => Math.min(moves.length - 1, i + 1))
            }}
            disabled={currentIndex === moves.length - 1}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
        <p className="text-center text-sm text-zinc-500">
          Move {currentIndex + 1} of {moves.length}:{' '}
          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{moves[currentIndex]}</span>
        </p>
        <MoveList
          moves={moves}
          currentIndex={currentIndex}
          onSelectIndex={(i) => {
            setIsPlaying(false)
            setCurrentIndex(i)
          }}
        />
      </div>

      <CoachChat faceletString={faceletString} solutionMoves={moves} />
    </div>
  )
}
