# Frontend

Next.js (App Router) PWA. Camera capture, color science, validation, and solving all run client-side — see the [project README](../README.md) and [docs/architecture.md](../docs/architecture.md) for the full picture.

```bash
npm install
npm run dev
```

Regression tests for the cube engine (`src/lib/cube/`):

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

With the app running on port 3000, run `npm run test:browser` (or set
`TEST_BASE_URL`). It uses Playwright Chromium with a synthetic camera at a mobile
viewport, covering capture, colors, corrections, rotation recovery, rescan edit
preservation, worker solving, synchronized playback, and the zero-move case.
Install Playwright's Chromium if your environment does not already provide it.
Synthetic frames do not replace a real-phone test under the user's lighting.
