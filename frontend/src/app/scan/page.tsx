'use client'

import { useState } from 'react'
import { buildFaceletString, rotateFace, SCAN_SEQUENCE } from '@/lib/cube/orientation'
import { classifyAllStickers, classifyRescannedFace } from '@/lib/cube/colorScience'
import { validateFaceletString } from '@/lib/cube/validation'
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

  const [scanStartedAt, setScanStartedAt] = useState<number | null>(() =>
    typeof window !== 'undefined' ? Date.now() : null
  )

  const currentStep = SCAN_SEQUENCE[stepIndex]
  const allCaptured = SCAN_SEQUENCE.every((s) => (rawCaptures[s.id]?.length ?? 0) === 9)

  function finalizeCaptures(all: Record<string, RGB[]>) {
    const flat = SCAN_SEQUENCE.flatMap((s) => all[s.id])
    const classified = classifyAllStickers(flat, 9, SCAN_SEQUENCE.map((_, index) => index * 9 + 4))

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
    if (captureMap) {
      const classified = classifyRescannedFace(samples, SCAN_SEQUENCE.map((step) => captureMap[step.id][4]))
      setCaptureMap({ ...captureMap, [currentStep.id]: samples.map((rgb, index) => ({ rgb, ...classified[index] })) })
      setValidation(null)
      setPhase('correction')
      return
    }
    if (stepIndex < SCAN_SEQUENCE.length - 1) {
      setStepIndex((i) => i + 1)
    } else if (SCAN_SEQUENCE.every((s) => (nextRaw[s.id]?.length ?? 0) === 9)) {
      finalizeCaptures(nextRaw)
    }
  }

  function handleChangeCell(stepId: string, index: number, color: CubeColorName) {
    setValidation(null)
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
    } catch (error) {
      setValidation({
        valid: false,
        issues: [{ code: 'CENTER_COLORS', message: error instanceof Error ? error.message : 'Please capture all six faces.' }],
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
          captureMap={captureMap}
          onCapture={handleCapture}
          onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
          onContinue={() => captureMap ? setPhase('correction') : finalizeCaptures(rawCaptures)}
        />
      )}
      {phase === 'correction' && captureMap && (
        <CorrectionPhase
          captureMap={captureMap}
          validation={validation}
          onChangeCell={handleChangeCell}
          onSolve={handleSolveClick}
          onRedoFace={handleRedoFace}
          onRotateFace={(stepId) => {
            setCaptureMap({ ...captureMap, [stepId]: rotateFace(captureMap[stepId]) })
            setValidation(null)
          }}
          onReplaceCaptures={(next) => { setCaptureMap(next); setValidation(null) }}
        />
      )}
      {phase === 'solve' && faceletString && captureMap && scanStartedAt !== null && (
        <SolvePhase
          faceletString={faceletString}
          captureMap={captureMap}
          scanStartedAt={scanStartedAt}
          onStartOver={handleStartOver}
          onReview={() => setPhase('correction')}
        />
      )}
    </main>
  )
}
