import assert from 'node:assert/strict'
import { chromium } from 'playwright'
// @ts-expect-error - cubejs ships no type declarations
import Cube from 'cubejs'

const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
await page.addInitScript(`(() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 360
  const context = canvas.getContext('2d')
  let colors = Array(9).fill('#00a000')
  Object.assign(window, { setCameraColors: (next) => { colors = next } })
  setInterval(() => {
    colors.forEach((color, index) => {
      context.fillStyle = color
      context.fillRect((index % 3) * 120, Math.floor(index / 3) * 120, 120, 120)
    })
  }, 30)
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => canvas.captureStream(30) })
})()`)

const swatches: Record<string, string> = { U: '#f0f0f0', R: '#b71220', F: '#008a41', D: '#ffd500', L: '#ff5800', B: '#0046ad' }
const names: Record<string, string> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' }
const faceOrder = ['U', 'R', 'F', 'D', 'L', 'B']
const scanOrder = ['F', 'R', 'B', 'L', 'U', 'D']
const titles: Record<string, string> = { F: 'Front', R: 'Right', B: 'Back', L: 'Left', U: 'Top', D: 'Bottom' }
const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

async function captureFace(state: string, face: string) {
  const offset = faceOrder.indexOf(face) * 9
  const colors = state.slice(offset, offset + 9).split('').map((letter) => swatches[letter])
  await page.evaluate((next) => (window as unknown as { setCameraColors: (colors: string[]) => void }).setCameraColors(next), colors)
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
}

try {
  const state: string = new Cube().move("R U2 F' L B D2 R2 U F L' B' D U' R").asString()
  await page.goto(`${baseURL}/scan`)
  for (const face of scanOrder) await captureFace(state, face)
  await page.getByRole('heading', { name: 'Review & correct' }).waitFor()
  for (const face of faceOrder) {
    const offset = faceOrder.indexOf(face) * 9
    for (let index = 0; index < 9; index++) {
      await page.getByRole('button', { name: `${titles[face]} face sticker ${index + 1}: ${names[state[offset + index]]}`, exact: true }).waitFor()
    }
  }
  await page.getByRole('button', { name: 'Rotate Front face clockwise' }).click()
  await page.getByRole('button', { name: 'Solve', exact: true }).click()
  await page.getByText("This scan isn't a valid cube state yet:").waitFor()
  await page.getByRole('button', { name: 'Check for sideways faces' }).click()
  await page.getByRole('button', { name: 'Apply these rotations' }).click()
  const originalColor = names[state[18]]
  const changedColor = originalColor === 'white' ? 'blue' : 'white'
  await page.getByRole('button', { name: `Front face sticker 1: ${originalColor}`, exact: true }).click()
  await page.getByRole('button', { name: changedColor, exact: true }).click()
  await page.getByRole('button', { name: 'Redo', exact: true }).nth(1).click()
  await captureFace(state, 'R')
  await page.getByRole('button', { name: `Front face sticker 1: ${changedColor}`, exact: true }).waitFor()
  await page.getByRole('button', { name: `Front face sticker 1: ${changedColor}`, exact: true }).click()
  await page.getByRole('button', { name: originalColor, exact: true }).click()
  await page.getByRole('button', { name: 'Solve', exact: true }).click()
  await page.getByRole('heading', { name: /Your solution/ }).waitFor({ timeout: 120_000 })
  await page.getByRole('status').filter({ hasText: 'Completed 0 of' }).waitFor()
  const moves = await page.locator('ol button').allTextContents()
  assert.ok(moves.length > 0)
  const cube = Cube.fromString(state)
  cube.move(moves.map((move) => move.replace(/^\d+/, '').trim()).join(' '))
  assert.equal(cube.isSolved(), true)
  await page.waitForFunction(() => !!document.querySelector('twisty-player'))
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Completed 1 of' }).waitFor()
  await page.waitForTimeout(500)
  const timestamp = await page.evaluate(async () => {
    const player = document.querySelector('twisty-player') as unknown as { experimentalModel: { timestampRequest: { get: () => Promise<number> } } }
    return player.experimentalModel.timestampRequest.get()
  })
  assert.ok(timestamp > 0, 'Next must advance the 3D player')
  for (let index = 1; index < moves.length; index++) await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Solved — all' }).waitFor()
  assert.ok(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled())
  await page.waitForTimeout(600)
  const timeline = await page.evaluate(async () => {
    const player = document.querySelector('twisty-player') as unknown as { experimentalModel: {
      timestampRequest: { get: () => Promise<number> }; indexer: { get: () => Promise<{ algDuration: () => number }> }
    } }
    return { timestamp: await player.experimentalModel.timestampRequest.get(), duration: (await player.experimentalModel.indexer.get()).algDuration() }
  })
  assert.equal(timeline.timestamp, timeline.duration, 'The 3D player must reach the solved end of the timeline')
  for (const face of faceOrder) {
    for (let index = 1; index <= 9; index++) {
      await page.getByLabel(`${face} sticker ${index}: ${names[face]}`, { exact: true }).waitFor()
    }
  }
  await page.screenshot({ path: '/tmp/rubik-solution.png', fullPage: true })
  await page.getByRole('button', { name: 'Scan another cube' }).click()
  const solved: string = new Cube().asString()
  for (const face of scanOrder) await captureFace(solved, face)
  await page.getByRole('button', { name: 'Solve', exact: true }).click()
  await page.getByText('Your cube is already solved. No moves needed!').waitFor({ timeout: 120_000 })
  assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: mobile capture → correction → rotation recovery → rescan preserves edits → worker solve → synchronized steps → solved cube')
} finally {
  await browser.close()
}
