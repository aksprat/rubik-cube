# Rubik's Cube Solver — Architecture & Planning

Living design doc for the app. Update this file (append to the Decision Log, revise sections above it) whenever a new architectural decision is made, rather than starting a new doc — keep one source of truth.

Last updated: 2026-07-23

## 1. Product summary

A camera-based Rubik's cube solver: the user photographs/scans all 6 faces of their cube one side at a time, the app validates and solves the resulting state, then walks them through the solution step by step. Supports 3x3 (primary) and 4x4 (Rubik's Revenge). Integrates DigitalOcean Serverless Inference for the coaching/explanation layer.

## 2. Core architectural decision: what AI is actually for

Multiple studies (CubeRobot; "Structured Task Solving via Modular Embodied Intelligence", arXiv:2507.05607; "Cube Bench", arXiv:2512.20595) found general-purpose vision-LLMs perform very poorly at reading a full 6-face cube state directly from images — tracking rotated faces into one consistent 3D state is a spatial-reasoning weak point for these models. Every production scanner app that works reliably (ruwix, qbr, CubeCV, dwalton76's tools) uses classical computer vision, not an LLM, for this step.

Consequence — AI is split into two distinct jobs, not one:

- **Scanning (cube state from images) → classical CV.** Deterministic, zero-latency, zero-cost, works offline. This is the primary path, not a model call.
- **Coaching / explanation / chat → DigitalOcean Serverless Inference LLM.** Turning a raw move list into a friendly tutorial, answering "why this move?", adapting tone/detail to skill level. This is where an LLM actually adds value.
- **Vision model → optional, narrow fallback only.** A vision-capable model may double-check a single cropped, upright face image when classical CV's confidence is low on a specific sticker. Never the primary scanning path.

Solving itself (turning a validated cube state into moves) is a solved algorithmic problem — not an LLM task at all, for either 3x3 or 4x4.

## 3. Models on DigitalOcean Serverless Inference

Base URL `https://inference.do-ai.run/v1/`, OpenAI-compatible (`/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, etc.). Auth via a scoped **Model Access Key** (Control Panel → Inference → Manage → Create model access key), restricted to only the models this app uses, kept server-side only — never shipped to the client.

| Role | Model | Rationale |
|---|---|---|
| **Coaching / chat / step narration** (chosen) | **DeepSeek V4 Flash** (~$0.11 / $0.22 per 1M input/output tokens) | Cheapest capable chat model in the catalog; good fit for short, frequent coaching replies and step narration. |
| Quality upgrade path | Llama 3.3 70B Instruct (~$0.65/$0.65 per 1M) | If DeepSeek V4 Flash's explanation quality proves insufficient in testing, swap here — same OpenAI-compatible call shape, just change the `model` field. |
| **Vision fallback (optional, v2)** | Nemotron Nano 12B v2 VL | DO's flagship documented small VLM; scope calls to a single cropped face image only. |
| Vision alt | Kimi K2.6 | Larger context if the fallback ever needs more than one image at a time. |

Caveats: DO's catalog and pricing change frequently — re-verify at `docs.digitalocean.com/products/inference/details/pricing/` before shipping. Rate limits are tiered by account spend/age (Tier 1–2 ≈ 120 RPM / 500K–750K TPM up to Tier 5 ≈ 4,500 RPM); open-weight models like DeepSeek V4 Flash are available even on the lowest tier (no Anthropic/OpenAI gating).

## 4. Solving engine

Two independent puzzle sizes, two different algorithmic approaches. Both share the same front-end pattern: scan → validate → solve → animate.

### 4a. 3x3

- **"Solve for me" mode**: Kociemba's two-phase algorithm via **cubejs** or **min2phase** (JS, MIT/GPL, tiny, runs entirely client-side in milliseconds, ~18–21 move solutions). No server round-trip needed.
- **"Teach me" mode**: hand-rolled layer-by-layer solver (cross → first-layer corners → middle edges → OLL → PLL as named, explainable stages) — deliberately not move-optimal, because explainability matters more than move count when teaching. Reference pattern: `zaidmukaddam/rubiks-cube-solver` ships exactly this dual-mode design.
- State representation: 54-character facelet string (9 stickers × 6 faces, URFDLB order). The face letter comes from each face's single fixed center sticker (centers never move on an odd-layered cube, so they reliably anchor color→face mapping).
- Validation before solving (4 checks, in order): sticker count (exactly 9 of each of 6 colors) → piece existence (8 distinct corners, 12 distinct edges each appear once) → orientation parity (corner twist sum ≡ 0 mod 3, edge flip sum ≡ 0 mod 2) → permutation parity (corner permutation parity == edge permutation parity). Surface the *specific* failure to the user (e.g. "one edge needs flipping — recheck faces X/Y") rather than a generic error, since the failure category points at the likely mis-scanned sticker.
- Visualization: **cubing.js** (`<twisty-player>` web component) for 3D animated playback with step controls (next/prev/play/pause/speed).

### 4b. 4x4 (Rubik's Revenge)

4x4 is algorithmically different from 3x3, not just "3x3 but bigger" — this affects both solving and scanning.

**Method — reduction (confirmed standard, used by every competitive and software solver):**
1. Build 6 solid 2×2 center blocks (one per face).
2. Pair the 24 outer "wing" pieces into 12 logical "dedges" that then behave like normal 3x3 edges.
3. Solve the reduced puzzle (corners + dedges) using a standard 3x3 method/engine.
4. Resolve two parity cases that exist only on even-layered cubes and are impossible on 3x3:
   - **OLL parity** ("edge parity") — one dedge ends up flipped after reduction. Detected/fixed during the OLL step. Fix: `Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'` (18-move; a 15-move equivalent also exists: `r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2`).
   - **PLL parity** — two dedges/corners need an odd-permutation swap unreachable on 3x3. Detected/fixed during the PLL step, after OLL parity is already resolved. Fix (opposite-case form): `r2 U2 r2 Uw2 r2 u2`.
   - These are *legitimate, expected* states on 4x4 — not scan errors. The validator must distinguish "this needs a parity fix algorithm" from "this cube was actually mis-scanned."
- 4x4 has no proven optimal move count (God's Number is unknown; only bounded, ~32–36 face turns per community estimates) unlike 3x3's proven 20 — reduction-based solves land around ~40–45 moves in practice (e.g. `cs0x7f/TPR-4x4x4-Solver`, ~44 moves, ~250ms), which is fine for this app since we're not chasing FMC records.

**State representation & validation differences from 3x3:**
- 96-character facelet string (16 stickers × 6 faces) vs. 3x3's 54.
- **No fixed center reference.** Each face has 4 separate center pieces (not 1), so — unlike 3x3 — you cannot read "which color is this face" from a center sticker. Face identity instead comes from the **guided capture sequence itself**: the app dictates a fixed scan order with explicit orientation instructions ("hold with green facing camera, white on top — capture"), so the face label is assigned by *position in the capture sequence*, not by reading cube content. This is confirmed as the actual approach used by dwalton76's scanner and Ruwix's scanner.
- Validation must be adapted: edge-flip parity is checked **per-orbit** rather than as one global sum (an odd flipped-wing count in one orbit is exactly OLL parity, and is a *legal* 4x4 state, unlike on 3x3 where the equivalent would mean a mis-scan). No center-permutation-parity check exists or is needed — same-color center pieces are visually indistinguishable from each other, so their internal arrangement is unobservable and irrelevant.

**Library / implementation gap — important:** there is no ready-made, browser-usable JavaScript/TypeScript library that actually *solves* 4x4 (as opposed to just rendering/animating it). `cubing.js` is excellent for 4x4 *visualization* (`cubing/twisty`) but its solving module (`cubing/search`) does not cover NxN. The one well-maintained, actually-solves-it implementation found is **`dwalton76/rubiks-cube-NxNxN-solver`** (Python, MIT, supports up to 17×17×17 via reduction + lookup tables, hands off to a 3x3 Kociemba engine for the final stage).

**Decision:** for v1, run 4x4 solving **server-side** by calling `dwalton76/rubiks-cube-NxNxN-solver` (Python) from the backend, rather than porting the reduction algorithm to TypeScript up front. This is why the backend is Python (FastAPI), not Node — it lets the 4x4 solver run in-process instead of shelling out across languages. Trade-off this creates: 3x3 solving is fully offline/client-side, but 4x4 solving requires a network round-trip in v1. Porting reduction logic to TS/WASM for offline 4x4 is a reasonable v2+ optimization once the rest of the app is stable, not a v1 requirement.

**"Teach me" mode for 4x4:** not planned for v1. Static tutorials for the reduction method are common, but no scanning app was found that offers an interactive, cube-state-aware teaching walkthrough for 4x4 the way 3x3 layer-by-layer teaching works — this looks like an engineering-effort gap rather than a hard blocker, worth revisiting once the 3x3 teach-mode is solid. v1 ships "solve for me" only for 4x4.

## 5. Scanning pipeline (client-side, classical CV)

1. Live camera preview with a 3x3 (or 4x4) grid overlay; guided face-by-face rotation sequence with explicit anchor instructions per step, since the app's own capture order determines face identity (critical for 4x4, harmless-but-still-good-practice for 3x3).
2. Live color preview updates before the user commits to a capture, so bad lighting/framing is caught immediately.
3. Per-sticker color classification: sample a small offset ROI (avoiding glare/edges), convert to Lab space, classify via Delta-E against calibrated references — resolve red/orange ambiguity via **global assignment** (exactly N stickers per color, where N is 9 for 3x3 / 16 for 4x4) rather than independent per-pixel thresholds, following dwalton76's `rubiks-color-resolver` approach.
4. **Mandatory** manual-correction screen (unfolded cube net + color picker) — every mature scanning tool treats this as non-optional, since no CV pipeline is 100% reliable across devices/lighting.
5. One-time per-cube color calibration step (factory sticker hues, especially orange, vary by brand).
6. Validation pass (see §4) before offering to solve, surfacing specific error categories rather than a generic failure.

## 6. Stack

- **Frontend**: React/Next.js as an installable **PWA** (not a native app) — `getUserMedia` for camera access, works cross-platform without app-store friction, works fully offline for 3x3 scanning + solving (only 4x4 solving and the AI coach need network).
- **Backend**: **Python (FastAPI) on DigitalOcean App Platform.** Responsibilities: (a) hold the DO Serverless Inference Model Access Key server-side and proxy chat/vision calls, (b) run 4x4 solves via `dwalton76/rubiks-cube-NxNxN-solver` in-process, (c) account/history CRUD. 3x3 solving and all scanning stay client-side.
- **Data**: DigitalOcean Managed Postgres — accounts, solve history, algorithm-trainer progress (v2).
- Images ideally never leave the device except when the vision-fallback path (v2) is triggered.

## 7. Feature roadmap

**MVP**
- Guided 6-face scan (3x3 and 4x4) → validation with specific error messages → solve (3x3: fast + teach-me; 4x4: fast only) → 3D animated stepper (cubing.js) → AI coach chat (DeepSeek V4 Flash) for "why this move?" and friendlier step narration → basic timer/history.

**v2 (differentiators — gaps found across every competitor app researched)**
- Accessibility: colorblind-safe palette, screen-reader-friendly flow, texture-based input alternative (à la Blind Cube) — almost no competitor does this.
- OLL/PLL/F2L algorithm trainer with spaced repetition — competitors track pass/fail but not spaced repetition.
- ao5/ao12 stats dashboard.
- Vision-LLM fallback (Nemotron Nano 12B v2 VL) for low-confidence stickers.
- 4x4 teach-me mode (static staged reduction walkthrough).
- Offline 4x4 solving (port reduction logic to TS/WASM, remove the server round-trip).

**Stretch**
- True AR overlay (turn-direction arrows rendered on the live camera feed of the physical cube).
- Additional puzzle sizes (2x2, 5x5+) — `dwalton76/rubiks-cube-NxNxN-solver` already supports up to 17×17, so this is mostly scanning-UX work once 4x4 is solid.

## 8. Decision log

- **2026-07-23** — Gotcha found while running the app locally: the backend's CORS check (`FRONTEND_ORIGIN`) must exactly match the port the frontend actually landed on. On this machine port 3000 is usually taken by an unrelated project, so `next dev` falls back to 3001 — but `backend/.env.example`'s default (`http://localhost:3000`) doesn't follow that fallback automatically. If the AI coach chat fails with a generic network error, check the backend log for `OPTIONS /api/coach/chat ... 400` (a CORS preflight rejection) and fix `FRONTEND_ORIGIN` in `backend/.env` to match whatever port `next dev` printed. Also: run `rm -rf frontend/.next` if you see a Turbopack "React Client Manifest" runtime error after mixing `next build` and `next dev` runs — stale cache, not an app bug.
- **2026-07-23** — AI split into two roles: classical CV for scanning (primary), DO Serverless Inference LLM for coaching/explanation (not scanning). Vision-capable model is an optional v2 fallback only, never the primary scan path.
- **2026-07-23** — Coaching/chat model: **DeepSeek V4 Flash**, chosen for cost. Llama 3.3 70B Instruct kept as a documented quality-upgrade path if needed.
- **2026-07-23** — Added 4x4 (Rubik's Revenge) to scope. Solving via reduction method + OLL/PLL parity fixes. No ready client-side JS solver exists, so v1 runs 4x4 solving server-side via `dwalton76/rubiks-cube-NxNxN-solver` (Python) — this is why the backend is FastAPI/Python rather than Node. 4x4 "teach me" mode deferred to v2.
- **2026-07-23** — 3x3 stays fully client-side/offline (cubejs or min2phase + hand-rolled LBL); only 4x4 solving and the AI coach require network in v1.
- **2026-07-23** — Started building. Scope trimmed for this first build pass (see §9 below): 3x3 "solve for me" only (no teach-me LBL yet, no 4x4 yet) plus the AI coach chat, to ship one fully-working vertical slice rather than several half-finished ones. Both are still planned, just not in this pass.
- **2026-07-23** — Verified the DO Serverless Inference integration end-to-end with a real Model Access Key. The catalog's actual slug is **`deepseek-4-flash`**, not `deepseek-v4-flash` as the display name "DeepSeek V4 Flash" suggested — corrected everywhere (`backend/.env`, `.env.example`, `app/main.py` default, README). Confirmed via `GET /v1/models` and two live `/api/coach/chat` calls (with and without solve context) that both returned coherent, on-topic replies.

## 9. Phase 1 build notes (what actually exists in the repo right now)

**Backend** (`backend/`): FastAPI, one real endpoint (`POST /api/coach/chat`) proxying to DO Serverless Inference via the `openai` SDK pointed at `https://inference.do-ai.run/v1/`. `DO_CHAT_MODEL` defaults to `deepseek-4-flash`, confirmed live (see decision log). No DB, no auth, no 4x4 — intentionally out of scope for now.

**Frontend** (`frontend/`): Next.js 16 (App Router, Turbopack, Tailwind v4). Cube logic lives in `src/lib/cube/` (`types.ts`, `orientation.ts`, `colorScience.ts`, `validation.ts`, `solve.ts`) and is covered by two standalone regression scripts (`scripts/test-cube-engine.ts`, `scripts/test-color-science.ts`, run via `npx tsx`) — run these after touching anything in `src/lib/cube/`.

Two things worth understanding for anyone touching this code later:

1. **Face identity comes from capture position, not color.** The guided scan (`orientation.ts`'s `SCAN_SEQUENCE`: front → right → back → left → up → down, each one simple physical turn from the last) assigns U/R/F/D/L/B by *which step of the sequence* a face was captured in, not by assuming a color scheme. Each face's own center sticker then tells you which physical color corresponds to that step's letter (centers never move on a 3x3). This works for any color scheme and needed no mirroring/rotation of any captured face's 9 values — verified two independent ways: (a) cross-checked directly against cubejs's internal corner/edge facelet-adjacency tables, and (b) an automated round-trip test (`test-cube-engine.ts`) that scrambles a cube with cubejs, simulates what the guided capture would read off that exact state, rebuilds the facelet string, and confirms it matches and solves correctly, across 6 scrambles including a 14-move one.
2. **cubejs's `Cube.fromString` does not validate.** It silently produces a broken `Cube` on illegal input rather than throwing, so `validation.ts` implements the standard four checks (sticker count, piece existence, orientation parity, permutation parity) ourselves before anything is handed to the solver, surfacing which specific check failed rather than a generic error.

Color classification (`colorScience.ts`) uses Lab-space distance with a few k-means-style recentering passes seeded from default reference swatches, then a greedy balancing pass that enforces exactly 9 stickers per color globally (across all 54 at once) — this is what resolves red/orange ambiguity, rather than a fixed per-pixel threshold. No explicit "calibrate your cube" onboarding flow yet (deferred); the mandatory manual-correction screen is the safety net for now.

The AI coach chat is wired into the solve screen, calling the backend with the current facelet string + solution moves as context. cubejs handles the fast/near-optimal 3x3 solve; `cubing/twisty`'s `TwistyPlayer` renders the animated 3D solution (setup state reconstructed as the inverse of the solution moves, avoiding a second facelet-to-alg conversion). Solve history (facelet string, moves, timestamp) is saved to `localStorage` only — no backend persistence yet.

**Deferred to the next pass**: 3x3 "teach me" (layer-by-layer) mode, all of 4x4, the vision-model scan fallback, accounts/stats/algorithm trainer, and a full offline service worker (only the installable manifest exists today).
