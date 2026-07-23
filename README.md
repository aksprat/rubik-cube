# Rubik's Cube Solver & Coach

Scan a physical Rubik's cube with your phone camera, get an optimal solution, and step through it with an AI coach that explains each move — powered by [DigitalOcean Gradient AI Platform Serverless Inference](https://docs.digitalocean.com/products/inference/).

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
       model=os.environ.get("DO_CHAT_MODEL", "deepseek-4-flash"),
       messages=messages,
       max_tokens=400,
   )
   ```
4. Returns the reply. The DigitalOcean **Model Access Key** (scoped to inference only, not a full account token) lives exclusively in this backend's environment — the frontend never sees it, and every call is proxied.

### Which model, and why

| | |
|---|---|
| **Chosen model** | [`deepseek-4-flash`](https://inference.do-ai.run/v1/models) (DeepSeek V4 Flash) |
| **Why** | This is a short, frequent, latency-sensitive workload (a chat coach answering quick questions) — DeepSeek V4 Flash is one of the cheapest capable chat models in DO's catalog (~$0.11 / $0.22 per 1M input/output tokens) and handles this kind of concise, single-turn coaching well. There's no reasoning-heavy or long-context need here that would justify a pricier model. |
| **Documented upgrade path** | `llama3.3-70b-instruct` — swap by changing `DO_CHAT_MODEL`, no code changes, if coaching quality ever needs to improve. |
| **Note on model IDs** | DigitalOcean's catalog identifies models by an internal slug that can differ from the display name — "DeepSeek V4 Flash" is actually `deepseek-4-flash` in the API, confirmed by querying `GET /v1/models` against a live account. Worth re-checking if you swap models, since the display name is not a reliable guess for the slug. |

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
