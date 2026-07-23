import type { CubeColorName } from '@/lib/cube/types'
import { SWATCH_HEX } from '@/lib/colorSwatches'

interface GridOverlayProps {
  previewColors: CubeColorName[]
}

// SVG 3x3 grid lines plus a matching 3x3 layer of small color swatches,
// overlaid on the live camera feed so the user gets live classification
// feedback before capturing.
export default function GridOverlay({ previewColors }: GridOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 300 300" className="h-full w-full" preserveAspectRatio="none">
        <rect x="2" y="2" width="296" height="296" fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="3" />
        <line x1="100" y1="0" x2="100" y2="300" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        <line x1="200" y1="0" x2="200" y2="300" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        <line x1="0" y1="100" x2="300" y2="100" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        <line x1="0" y1="200" x2="300" y2="200" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {previewColors[i] && (
              <span
                className="h-4 w-4 rounded-full border border-black/40 shadow"
                style={{ backgroundColor: SWATCH_HEX[previewColors[i]] }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
