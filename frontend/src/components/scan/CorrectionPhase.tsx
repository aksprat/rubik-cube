'use client'

import { useState } from 'react'
import { SCAN_SEQUENCE, TOP_EDGE_FACE } from '@/lib/cube/orientation'
import { findFaceRotations, type RotationRecovery } from '@/lib/cube/rotationRecovery'
import { CUBE_COLORS } from '@/lib/cube/types'
import type { CaptureMap, CubeColorName, ValidationResult } from '@/lib/cube/types'
import { SWATCH_HEX } from '@/lib/colorSwatches'

interface CorrectionPhaseProps {
  captureMap: CaptureMap
  validation: ValidationResult | null
  onChangeCell: (stepId: string, index: number, color: CubeColorName) => void
  onSolve: () => void
  onRedoFace: (stepIndex: number) => void
  onRotateFace: (stepId: string) => void
  onReplaceCaptures: (captures: CaptureMap) => void
}

interface ActiveCell {
  stepId: string
  index: number
}

const LOW_CONFIDENCE_THRESHOLD = 0.3

export default function CorrectionPhase({
  captureMap,
  validation,
  onChangeCell,
  onSolve,
  onRedoFace,
  onRotateFace,
  onReplaceCaptures,
}: CorrectionPhaseProps) {
  const [active, setActive] = useState<ActiveCell | null>(null)
  const [recovery, setRecovery] = useState<{ source: CaptureMap; result: RotationRecovery } | null>(null)
  const [checking, setChecking] = useState(false)
  const counts = CUBE_COLORS.map((color) => ({ color, count: Object.values(captureMap).flat().filter((sticker) => sticker.color === color).length }))
  const centersUnique = new Set(SCAN_SEQUENCE.map((step) => captureMap[step.id][4].color)).size === 6
  const rotationResult = recovery?.source === captureMap ? recovery.result : null

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; correct</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tap any sticker to fix its color. Cells outlined in red were low-confidence reads — double-check those
          first.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <p>Each color needs 9 stickers and a different center. A correct color count alone does not guarantee a solvable cube.</p>
        <div className="flex flex-wrap gap-2">
          {counts.map(({ color, count }) => <span key={color} className={count === 9 ? '' : 'font-bold text-red-600'}>{color}: {count}/9</span>)}
        </div>
        {!centersUnique && <p role="alert" className="font-medium text-red-600">Duplicate center colors: correct the centers or rescan the wrong face.</p>}
        <p>For each grid, look directly at that face with the indicated neighboring center above its top edge. Rotate the grid if you captured it sideways.</p>
      </div>

      {validation && !validation.valid && (
        <div className="rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">This scan isn&apos;t a valid cube state yet:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {validation.issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
        <button type="button" disabled={checking || !centersUnique || counts.some(({ count }) => count !== 9)}
          className="text-blue-600 underline disabled:opacity-40"
          onClick={() => {
            setChecking(true)
            setTimeout(() => {
              setRecovery({ source: captureMap, result: findFaceRotations(captureMap) })
              setChecking(false)
            }, 0)
          }}>
          {checking ? 'Checking orientations…' : 'Check for sideways faces'}
        </button>
        {rotationResult?.status === 'none' && <p>No solution from rotations alone. Recheck sticker colors and face order; rescan if needed.</p>}
        {rotationResult?.status === 'ambiguous' && <p>Several different cube states fit these colors. We will not guess. Use the top-edge hints to rotate the grids or rescan.</p>}
        {rotationResult?.status === 'unique' && <>
          <p>One solvable state fits face rotations. Check these clockwise grid rotations against your cube before applying:</p>
          <p>{SCAN_SEQUENCE.filter((step) => rotationResult.turns[step.id]).map((step) => `${step.title}: ${rotationResult.turns[step.id] * 90}°`).join(', ') || 'No rotations needed.'}</p>
          <button type="button" className="text-blue-600 underline" onClick={() => onReplaceCaptures(rotationResult.captures)}>Apply these rotations</button>
        </>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {SCAN_SEQUENCE.map((step, stepIdx) => (
          <div key={step.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">{step.title}</span>
              <button
                type="button"
                onClick={() => onRedoFace(stepIdx)}
                className="text-xs text-blue-600 underline underline-offset-2"
              >
                Redo
              </button>
            </div>
            <p className="text-xs text-zinc-500">Top edge: {captureMap[TOP_EDGE_FACE[step.id]][4].color} center</p>
            <div className="grid grid-cols-3 gap-0.5 rounded border border-zinc-300 bg-zinc-200 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
              {captureMap[step.id].map((sticker, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive({ stepId: step.id, index: i })}
                  className={`aspect-square ${
                    sticker.confidence < LOW_CONFIDENCE_THRESHOLD ? 'ring-2 ring-inset ring-red-500' : ''
                  }`}
                  style={{ backgroundColor: SWATCH_HEX[sticker.color] }}
                  aria-label={`${step.title} sticker ${i + 1}: ${sticker.color}`}
                  title={`${sticker.color} (confidence ${(sticker.confidence * 100).toFixed(0)}%)`}
                />
              ))}
            </div>
            <button type="button" onClick={() => onRotateFace(step.id)} className="text-xs text-blue-600 underline" aria-label={`Rotate ${step.title} clockwise`}>Rotate ↻</button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onSolve}
        className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
      >
        Solve
      </button>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="rounded-lg bg-white p-4 shadow-lg dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium">Choose the correct color</p>
            <div className="grid grid-cols-3 gap-3">
              {CUBE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChangeCell(active.stepId, active.index, color)
                    setActive(null)
                  }}
                  className="h-12 w-12 rounded-md border border-zinc-300 dark:border-zinc-600"
                  style={{ backgroundColor: SWATCH_HEX[color] }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
