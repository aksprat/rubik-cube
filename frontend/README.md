# Frontend

Next.js (App Router) PWA. Camera capture, color science, validation, and solving all run client-side — see the [project README](../README.md) and [docs/architecture.md](../docs/architecture.md) for the full picture.

```bash
npm install
npm run dev
```

Regression tests for the cube engine (`src/lib/cube/`):

```bash
npx tsx scripts/test-cube-engine.ts
npx tsx scripts/test-color-science.ts
```
