'use client'

import { useEffect, useRef, useState } from 'react'
import { startSolve } from '@/lib/cube/solverClient'
import type { CaptureMap } from '@/lib/cube/types'
import { describeMove } from '@/lib/moves'
import { saveSolveToHistory } from '@/lib/history'
import MoveList from './MoveList'
import TwistyCube from '@/components/cube/TwistyCube'
import CubeNet from '@/components/cube/CubeNet'
import CoachChat from '@/components/coach/CoachChat'

interface SolvePhaseProps {
  faceletString: string
  captureMap: CaptureMap
  scanStartedAt: number
  onStartOver: () => void
  onReview: () => void
}

type SolverStatus = 'warming' | 'ready' | 'error'

const PLAY_INTERVAL_MS = 900

export default function SolvePhase({
  faceletString,
  captureMap,
  scanStartedAt,
  onStartOver,
  onReview,
}: SolvePhaseProps) {
  const [status, setStatus] = useState<SolverStatus>('warming')
  const [moves, setMoves] = useState<string[] | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const savedRef = useRef(false)
  const [error, setError] = useState('Something went wrong computing the solution.')

  useEffect(() => {
    let mounted = true
    let task: ReturnType<typeof startSolve> | undefined
    Promise.resolve().then(() => {
      if (!mounted) return
      task = startSolve(faceletString)
      return task.result
    }).then(
      (result) => {
        if (!mounted) return
        setMoves(result!)
        setStatus('ready')
      },
      (reason) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'Could not solve this cube.')
          setStatus('error')
        }
      }
    )
    return () => {
      mounted = false
      task?.cancel()
    }
  }, [faceletString])

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

  const isAtEnd = !!moves && currentIndex >= moves.length

  // Only schedules further ticks while playing and not yet at the end;
  // simply stops scheduling once the end is reached (rather than
  // synchronously flipping isPlaying from inside the effect body — the
  // Play/Pause button instead derives its label from `isAtEnd`).
  useEffect(() => {
    if (!isPlaying || !moves || isAtEnd) return
    const timer = setTimeout(() => {
      setCurrentIndex((index) => Math.min(moves.length, index + 1))
    }, PLAY_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, currentIndex, moves, isAtEnd])

  if (status === 'warming') {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
        Preparing and solving your cube… This can take a few seconds.
      </div>
    )
  }

  if (status === 'error' || !moves) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-red-600">
        <p>{error}</p>
        <button type="button" onClick={onReview} className="underline">
          Back to review
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

      <p className="rounded border border-blue-300 p-3 text-sm">
        Hold the <strong>{captureMap.front[4].color} center toward you</strong> and the <strong>{captureMap.up[4].color} center on top</strong> throughout the solution.
        {' '}U = top, R = right, F = front, D = bottom, L = left, B = back. A prime (′) means counterclockwise; 2 means a half turn.
      </p>
      <TwistyCube solutionMoves={moves} completedMoves={currentIndex} />
      <p className="text-center text-xs text-zinc-500">The 3D diagram uses standard colors (green front, white top). These grids use your actual cube colors:</p>
      <CubeNet faceletString={faceletString} moves={moves} completedMoves={currentIndex} captureMap={captureMap} />

      {moves.length === 0 ? <p role="status" className="text-center font-medium">Your cube is already solved. No moves needed!</p> : <div className="space-y-3">
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
              setCurrentIndex((index) => Math.min(moves.length, index + 1))
            }}
            disabled={isAtEnd}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
        <p role="status" className="text-center text-sm text-zinc-500">
          {isAtEnd ? `Solved — all ${moves.length} moves completed.` : `Completed ${currentIndex} of ${moves.length}. Next: ${moves[currentIndex]}. ${describeMove(moves[currentIndex])}`}
        </p>
        <MoveList
          moves={moves}
          currentIndex={currentIndex}
          onSelectIndex={(i) => {
            setIsPlaying(false)
            setCurrentIndex(i)
          }}
        />
      </div>}

      <button type="button" onClick={onReview} className="text-sm text-blue-600 underline">Back to review colors</button>
      <CoachChat faceletString={faceletString} solutionMoves={moves} completedMoves={currentIndex} frontColor={captureMap.front[4].color} topColor={captureMap.up[4].color} />
    </div>
  )
}
