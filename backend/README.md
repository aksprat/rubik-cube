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

`DO_CHAT_MODEL` defaults to `anthropic-claude-haiku-4.5` (Claude Haiku 4.5).
This is a cost-conscious coaching recommendation, not a replacement for the
client-side scanner or deterministic solver. The prompt uses the verified move
list, completed-move count, and holding orientation; it prohibits invented
solutions. Requests time out rather than leaving the coach waiting indefinitely.

DigitalOcean's published catalog, pricing, and limits were checked on 2026-10-03:
Haiku costs $1 input / $5 output per million tokens and requires Tier 3+.
At the same token counts, this is 67% cheaper than Sonnet 4.6.
Check your account and Model Access Key before deploying; no live inference call
was made during this change. For a cheaper, non-Anthropic alternative, explicitly
set `DO_CHAT_MODEL=llama3.3-70b-instruct`.

**Existing deployments:** set `DO_CHAT_MODEL=anthropic-claude-haiku-4.5` in the backend
App Platform environment and local `.env`, replacing any DeepSeek or Sonnet value. Authorize Haiku in your key,
and redeploy. Changing the code default does not override a deployed environment
variable. The API base URL stays `https://inference.do-ai.run/v1/`.

Check the exact slug and availability with your account:

```bash
curl https://inference.do-ai.run/v1/models \
  -H "Authorization: Bearer $DO_INFERENCE_API_KEY"
```

Run the mocked backend regression tests with `python -m unittest -v test_coach`
from `backend/`. They exercise the model default/override, progress context,
empty responses, and sanitized upstream errors without making paid calls.
