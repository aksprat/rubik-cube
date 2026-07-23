'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CubeColorName, RGB, ScanStepDef } from '@/lib/cube/types'
import { quickClassifySingle } from '@/lib/cube/colorScience'
import { drawSquareVideoFrame, sampleGridCells } from '@/lib/scanCapture'
import GridOverlay from './GridOverlay'

interface CapturePhaseProps {
  step: ScanStepDef
  stepIndex: number
  totalSteps: number
  allCaptured: boolean
  onCapture: (samples: RGB[]) => void
  onBack: () => void
  onContinue: () => void
}

export default function CapturePhase({
  step,
  stepIndex,
  totalSteps,
  allCaptured,
  onCapture,
  onBack,
  onContinue,
}: CapturePhaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [previewColors, setPreviewColors] = useState<CubeColorName[]>([])

  // Request camera access once, on mount. Cleaned up on unmount (i.e. when
  // leaving the capture phase entirely).
  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
          } catch {
            // Autoplay can be rejected in some browsers until a user
            // gesture; the video will still start once one occurs.
          }
        }
        setCameraReady(true)
        setCameraError(null)
      } catch (err) {
        let message = 'Could not access the camera on this device.'
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            message = 'Camera access was denied. Allow camera access in your browser settings and reload the page.'
          } else if (err.name === 'NotFoundError') {
            message = 'No camera was found on this device.'
          } else if (err.name === 'NotReadableError') {
            message = 'The camera is already in use by another application.'
          }
        }
        setCameraError(message)
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Live preview: sample the 9 cells every ~300ms and classify each with the
  // fast single-sample classifier for immediate visual feedback.
  useEffect(() => {
    if (!cameraReady) return
    const interval = setInterval(() => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) return
      if (!drawSquareVideoFrame(video, canvas)) return
      const samples = sampleGridCells(canvas)
      setPreviewColors(samples.map(quickClassifySingle))
    }, 300)
    return () => clearInterval(interval)
  }, [cameraReady])

  const handleCaptureClick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (!drawSquareVideoFrame(video, canvas)) return
    const samples = sampleGridCells(canvas)
    onCapture(samples)
  }, [onCapture])

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-4">
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-500">
          Step {stepIndex + 1} of {totalSteps}: {step.title}
        </p>
        <p className="mt-1 text-base">{step.instruction}</p>
      </div>

      {cameraError ? (
        <div
          role="alert"
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-red-400 bg-red-50 p-6 text-center text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-medium">Camera unavailable</p>
          <p>{cameraError}</p>
        </div>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
          <GridOverlay previewColors={previewColors} />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
              Starting camera…
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" aria-hidden />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={stepIndex === 0}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-3 font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCaptureClick}
          disabled={!cameraReady || !!cameraError}
          className="flex-[2] rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Capture
        </button>
      </div>

      {allCaptured && (
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md border border-blue-600 px-4 py-3 font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
        >
          Continue to review
        </button>
      )}
    </div>
  )
}
