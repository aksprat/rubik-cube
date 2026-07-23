import { classifyAllStickers } from '../src/lib/cube/colorScience'
import { CUBE_COLORS } from '../src/lib/cube/types'

const refs: Record<string, {r:number,g:number,b:number}> = {
  white: { r: 240, g: 240, b: 240 },
  yellow: { r: 255, g: 213, b: 0 },
  red: { r: 183, g: 18, b: 32 },
  orange: { r: 255, g: 88, b: 0 },
  green: { r: 0, g: 138, b: 65 },
  blue: { r: 0, g: 70, b: 173 },
}

// 9 of each color, with small random jitter to simulate camera noise, in shuffled order
const samples: {rgb: {r:number,g:number,b:number}, expected: string}[] = []
for (const color of CUBE_COLORS) {
  for (let i = 0; i < 9; i++) {
    const base = refs[color]
    const jitter = () => Math.round((Math.random() - 0.5) * 20)
    samples.push({
      rgb: { r: base.r + jitter(), g: base.g + jitter(), b: base.b + jitter() },
      expected: color,
    })
  }
}
// shuffle
for (let i = samples.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[samples[i], samples[j]] = [samples[j], samples[i]]
}

const results = classifyAllStickers(samples.map((s) => s.rgb))
let correct = 0
for (let i = 0; i < samples.length; i++) {
  if (results[i].color === samples[i].expected) correct++
}
console.log(`Correct: ${correct}/${samples.length}`)
for (const color of CUBE_COLORS) {
  const count = results.filter((r) => r.color === color).length
  console.log(`  ${color}: ${count} (expected 9)`)
}
if (correct !== samples.length) {
  console.log('MISMATCHES:')
  for (let i = 0; i < samples.length; i++) {
    if (results[i].color !== samples[i].expected) {
      console.log(`  expected ${samples[i].expected}, got ${results[i].color}, rgb=${JSON.stringify(samples[i].rgb)}`)
    }
  }
}
