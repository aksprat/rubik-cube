# Rubik's Cube Solver & Coach

Scan a physical Rubik's cube with your phone camera, get a verified solution, and step through it with an AI coach that explains moves — powered by [DigitalOcean Serverless Inference Platform](https://docs.digitalocean.com/products/inference/).

Full design rationale and decision log: [docs/architecture.md](docs/architecture.md).

## What it does

1. **Scan** — a guided, camera-driven flow walks you through all 6 faces of a 3x3 cube, one simple physical turn at a time. No color scheme is assumed; each face's own center sticker tells the app which physical color is which.
2. **Validate** — the scanned state is checked against the four standard legality rules (sticker counts, piece existence, orientation parity, permutation parity) before it's ever handed to a solver, with specific, actionable error messages if something looks mis-scanned.
3. **Solve** — a near-optimal solution (Kociemba's two-phase algorithm, typically 18-21 moves) is computed entirely client-side and animated on a live 3D cube.
4. **Coach** — an AI chat panel, backed by DigitalOcean Serverless Inference, answers "why is this move needed?" and explains the solution in plain language.

3x3 only for now; 4x4 and a beginner "teach me" layer-by-layer mode are planned (see the roadmap in [docs/architecture.md](docs/architecture.md)).

## How it's built

A small monorepo, split by what actually needs a server:

```
frontend/   Next.js 16 (App Router) PWA — camera capture, color science, validation,
            solving, and 3D visualization all run entirely client-side and offline.
backend/    FastAPI — the ONLY thing that needs a server: proxying AI coach chat
            requests to DigitalOcean Serverless Inference so the API key never
            reaches the browser.
docs/       Architecture & planning doc, updated as decisions are made.
```

**Why almost everything is client-side:** cube-state scanning is a solved problem with classical computer vision (color sampling in Lab space + a global "exactly N stickers per color" balancing pass), and cube-solving is a solved problem with Kociemba's algorithm — neither needs an LLM or a server round-trip. Research done before building this (see `docs/architecture.md` §2) found that general-purpose vision-LLMs are actually *bad* at reading a full 6-face cube state from images, so classical CV is the primary scanning path, not an AI model call. That leaves exactly one place where an LLM adds real value: turning a raw move list into a coached, conversational explanation. That's the only feature that talks to a server.

Key implementation detail worth knowing: face identity (which physical face is U/R/F/D/L/B) comes from *where in the guided capture sequence* a face was scanned, not from assuming any color scheme — verified both against `cubejs`'s internal facelet-adjacency tables and with an automated round-trip test (`frontend/scripts/test-cube-engine.ts`) that scrambles a cube, simulates the capture, and confirms the rebuilt state solves correctly.

## DigitalOcean Serverless Inference integration

The backend (`backend/app/main.py`) exposes one endpoint, `POST /api/coach/chat`, which:

1. Builds a system prompt establishing the assistant as a cube coach (concise, encouraging, uses standard cube notation).
2. Optionally appends a second system message summarizing the user's current cube state and solution moves, so the coach can answer questions grounded in the actual solve.
3. Calls DigitalOcean's Serverless Inference API using the official **OpenAI Python SDK**, just pointed at a different base URL — DO's serverless inference endpoint is fully OpenAI-`chat.completions`-compatible:

   ```python
   client = OpenAI(
       base_url="https://inference.do-ai.run/v1/",
       api_key=os.environ["DO_INFERENCE_API_KEY"],
   )
   completion = client.chat.completions.create(
       model=os.environ.get("DO_CHAT_MODEL", "anthropic-claude-haiku-4.5"),
       messages=messages,
       max_tokens=800,
   )
   ```
4. Returns the reply. The DigitalOcean **Model Access Key** (scoped to inference only, not a full account token) lives exclusively in this backend's environment — the frontend never sees it, and every call is proxied.

### Which model, and why

| | |
|---|---|
| **Default model** | `anthropic-claude-haiku-4.5` (Claude Haiku 4.5), replacing DeepSeek V4 Flash. |
| **Rationale** | Cost-conscious choice for following the verified move list and explaining notation in conversation, selected instead of Sonnet 4.6. This is a recommendation, not a measured head-to-head quality result; validate with real coaching questions before production rollout. |
| **Cost and access** | DigitalOcean lists $1 input / $5 output per million tokens and restricts Anthropic models to Tier 3+ (checked 2026-10-03). A 1,000-input/300-output-token reply is about $0.0025, excluding caching—67% less than Sonnet 4.6 at the same token counts. |
| **Lower-cost alternative** | Set `DO_CHAT_MODEL=llama3.3-70b-instruct` if Anthropic access or cost is unsuitable. Model switching is explicit; there is no silent fallback. |
| **Deployment** | Set the backend App Platform environment variable to `DO_CHAT_MODEL=anthropic-claude-haiku-4.5`, authorize Haiku in the Model Access Key, and redeploy. Any existing DeepSeek or Sonnet environment value overrides the new code default. |

Sources: DigitalOcean [model catalog](https://docs.digitalocean.com/products/inference/details/models/), [pricing](https://docs.digitalocean.com/products/inference/details/pricing/), and [account limits](https://docs.digitalocean.com/products/inference/details/limits/). Availability must also be checked against your account's `/v1/models` response. The new model has not been called with a live account as part of this fix.

**Changing the model does not fix scanning or solving.** Images never go to the coach. Median pixel sampling and center-calibrated color classification run locally; a deterministic solver generates moves in a Web Worker and verifies that applying them solves the exact scanned state. The coach receives the starting state, verified moves, completed-move count, and actual front/top colors. It is instructed not to invent a solution or pretend a short Kociemba solution is a beginner method.

### Scanning and correction troubleshooting

- Fill the camera square with one face, straight-on, in even light. Move the entire cube between captures; do not turn individual layers.
- Capture front → right → back → left with the same top face. For the top capture, the back face borders the grid's top edge; for the bottom capture, the front face borders its top edge.
- Review six distinct centers and nine stickers per color. Counts alone cannot prove a valid state. Forced color assignments and ambiguous colors are flagged for review.
- Correct stickers, rotate sideways grids, or use **Check for sideways faces**. Only a unique valid state can be proposed, and applying it requires confirmation; ambiguous states are not guessed.
- **Redo** replaces only that face and returns to review, preserving other faces and manual corrections. Rescans are not forced to fit a nine-per-color quota.
- Follow the displayed front/top holding orientation. Next/Previous/Play now share the 3D timeline; the six small grids display the actual scanned color scheme. An already solved cube explicitly needs zero moves.

A vision-capable model (e.g. `nemotron-nano-12b-v2-vl`) is documented as a possible *narrow, optional* fallback for scanning specific low-confidence stickers, but is explicitly **not** part of the primary scanning pipeline — see the rationale in `docs/architecture.md` §2.

## Live deployment

Deployed on [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform): **https://rubik-cube-solver-94w4m.ondigitalocean.app**

One app, two components sharing a single domain via path-based ingress routing (`/api/*` → backend, `/` → frontend) — no CORS needed in production, since the browser sees same-origin requests. Auto-deploys on every push to `main`. `DO_INFERENCE_API_KEY` is stored as an encrypted `SECRET`-type environment variable on the backend component only.

## Running it locally

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in DO_INFERENCE_API_KEY with a real Model Access Key
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Then open the URL Next.js prints (defaults to `http://localhost:3000`, falls back to another port if that one's taken). Camera access requires a real device — a phone with a rear camera works best.

If the AI coach chat fails locally, check `backend/.env`'s `FRONTEND_ORIGIN` matches whatever port the frontend actually printed (see the gotcha logged in `docs/architecture.md`).

## Security

- The DigitalOcean Model Access Key and all other secrets live only in `backend/.env`, which is gitignored (see `backend/.gitignore` and the root `.gitignore`) and is never committed.
- `.env.example` / `.env.local.example` files document *which* variables are needed without containing real values.
- The Model Access Key used should be scoped to Serverless Inference only (create one under DigitalOcean's Control Panel → Inference → Manage → Create model access key) rather than a full-account Personal Access Token, so a leak can't reach anything beyond inference usage.
- In production (DigitalOcean App Platform), secrets are set as **encrypted** environment variables on the backend component — never baked into the frontend bundle or the repo.
