'use client'

import { useState } from 'react'
import { buildFaceletString, SCAN_SEQUENCE } from '@/lib/cube/orientation'
import { classifyAllStickers } from '@/lib/cube/colorScience'
import { validateFaceletString } from '@/lib/cube/validation'
import { ensureSolverReady } from '@/lib/cube/solve'
import type { CaptureMap, CubeColorName, RGB, ValidationResult } from '@/lib/cube/types'
import CapturePhase from '@/components/scan/CapturePhase'
import CorrectionPhase from '@/components/scan/CorrectionPhase'
import SolvePhase from '@/components/scan/SolvePhase'

type Phase = 'capture' | 'correction' | 'solve'

export default function ScanPage() {
  const [phase, setPhase] = useState<Phase>('capture')
  const [stepIndex, setStepIndex] = useState(0)
  const [rawCaptures, setRawCaptures] = useState<Record<string, RGB[]>>({})
  const [captureMap, setCaptureMap] = useState<CaptureMap | null>(null)
  const [faceletString, setFaceletString] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)

  // Kick off the solver warm-up as early as possible, via a lazy initial
  // state so it runs exactly once on the very first client render (this
  // never runs during the static SSR prerender since it's gated on
  // `window`, and — unlike history's localStorage read — nothing about the
  // capture phase's rendered output depends on it, so there's no hydration
  // mismatch risk in computing it this way instead of in an effect).
  const [solverReadyPromise] = useState<Promise<void> | null>(() =>
    typeof window !== 'undefined' ? ensureSolverReady() : null
  )
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(() =>
    typeof window !== 'undefined' ? Date.now() : null
  )

  const currentStep = SCAN_SEQUENCE[stepIndex]
  const allCaptured = SCAN_SEQUENCE.every((s) => (rawCaptures[s.id]?.length ?? 0) === 9)

  function finalizeCaptures(all: Record<string, RGB[]>) {
    // classifyAllStickers must be called once on the full 54-sample batch so
    // it can globally balance "exactly 9 per color" (e.g. resolving
    // red/orange ambiguity) rather than per-face.
    const flat = SCAN_SEQUENCE.flatMap((s) => all[s.id])
    const classified = classifyAllStickers(flat)

    let idx = 0
    const map: CaptureMap = {}
    for (const step of SCAN_SEQUENCE) {
      map[step.id] = all[step.id].map((rgb) => {
        const c = classified[idx]
        idx += 1
        return { rgb, color: c.color, confidence: c.confidence }
      })
    }
    setCaptureMap(map)
    setValidation(null)
    setPhase('correction')
  }

  function handleCapture(samples: RGB[]) {
    const nextRaw = { ...rawCaptures, [currentStep.id]: samples }
    setRawCaptures(nextRaw)
    if (stepIndex < SCAN_SEQUENCE.length - 1) {
      setStepIndex((i) => i + 1)
    } else if (SCAN_SEQUENCE.every((s) => (nextRaw[s.id]?.length ?? 0) === 9)) {
      finalizeCaptures(nextRaw)
    }
  }

  function handleChangeCell(stepId: string, index: number, color: CubeColorName) {
    setCaptureMap((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [stepId]: prev[stepId].map((sticker, i) => (i === index ? { ...sticker, color, confidence: 1 } : sticker)),
      }
    })
  }

  function handleSolveClick() {
    if (!captureMap) return
    try {
      const fs = buildFaceletString(captureMap)
      const result = validateFaceletString(fs)
      setFaceletString(fs)
      setValidation(result)
      if (result.valid) {
        setPhase('solve')
      }
    } catch {
      setValidation({
        valid: false,
        issues: [{ code: 'BAD_LENGTH', message: 'The scan is incomplete — go back and capture every face.' }],
      })
    }
  }

  function handleRedoFace(index: number) {
    setStepIndex(index)
    setPhase('capture')
  }

  function handleStartOver() {
    setPhase('capture')
    setStepIndex(0)
    setRawCaptures({})
    setCaptureMap(null)
    setFaceletString(null)
    setValidation(null)
    setScanStartedAt(Date.now())
  }

  return (
    <main className="flex flex-1 flex-col">
      {phase === 'capture' && (
        <CapturePhase
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={SCAN_SEQUENCE.length}
          allCaptured={allCaptured}
          onCapture={handleCapture}
          onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
          onContinue={() => finalizeCaptures(rawCaptures)}
        />
      )}
      {phase === 'correction' && captureMap && (
        <CorrectionPhase
          captureMap={captureMap}
          validation={validation}
          onChangeCell={handleChangeCell}
          onSolve={handleSolveClick}
          onRedoFace={handleRedoFace}
        />
      )}
      {phase === 'solve' && faceletString && solverReadyPromise && scanStartedAt !== null && (
        <SolvePhase
          faceletString={faceletString}
          solverReadyPromise={solverReadyPromise}
          scanStartedAt={scanStartedAt}
          onStartOver={handleStartOver}
        />
      )}
    </main>
  )
}
