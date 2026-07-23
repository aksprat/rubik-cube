'use client'

import { useState } from 'react'
import { SCAN_SEQUENCE } from '@/lib/cube/orientation'
import { CUBE_COLORS } from '@/lib/cube/types'
import type { CaptureMap, CubeColorName, ValidationResult } from '@/lib/cube/types'
import { SWATCH_HEX } from '@/lib/colorSwatches'

interface CorrectionPhaseProps {
  captureMap: CaptureMap
  validation: ValidationResult | null
  onChangeCell: (stepId: string, index: number, color: CubeColorName) => void
  onSolve: () => void
  onRedoFace: (stepIndex: number) => void
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
}: CorrectionPhaseProps) {
  const [active, setActive] = useState<ActiveCell | null>(null)

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; correct</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tap any sticker to fix its color. Cells outlined in red were low-confidence reads — double-check those
          first.
        </p>
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
