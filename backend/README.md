# Rubik's Cube Coach Backend

## What this service does

This is a minimal FastAPI backend whose **only** job (in this phase) is to
securely proxy chat requests from the frontend to DigitalOcean's Serverless
Inference API. The DigitalOcean Model Access Key lives only on this server
and is never sent to or exposed in the browser.

Scope is intentionally narrow:
- One endpoint, `POST /api/coach/chat`, that forwards a chat conversation
  (plus optional Rubik's cube solve context) to a DO-hosted chat model and
  returns the assistant's reply.
- One health check endpoint, `GET /api/health`.
- No database. No authentication. No cube-solving logic (2x2/3x3 solving,
  4x4+ solving, etc.) — those are out of scope and will come in later
  phases.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the example env file and fill in your real credentials:

```bash
cp .env.example .env
```

Edit `.env` and set `DO_INFERENCE_API_KEY` to a DigitalOcean **Model Access
Key** scoped to Serverless Inference (create one from the DigitalOcean
control panel under the GenAI / Serverless Inference section). Adjust
`FRONTEND_ORIGIN` if your frontend runs somewhere other than
`http://localhost:3000`.

## Running

```bash
uvicorn app.main:app --reload --port 8000
```

Then check:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

## `DO_CHAT_MODEL`

`DO_CHAT_MODEL` defaults to `deepseek-4-flash`. This was verified on
2026-07-23 against a live DigitalOcean account via `GET
https://inference.do-ai.run/v1/models` — note the catalog's actual slug is
`deepseek-4-flash`, not `deepseek-v4-flash` as the display name "DeepSeek V4
Flash" might suggest. DigitalOcean's serverless inference catalog identifies
models by an internal slug that can differ from the human-readable display
name, and available models/slugs can change over time, so re-check this if
chat requests start failing with a model-not-found error:

```bash
curl https://inference.do-ai.run/v1/models \
  -H "Authorization: Bearer $DO_INFERENCE_API_KEY"
```
