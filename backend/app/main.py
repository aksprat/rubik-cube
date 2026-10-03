"""FastAPI backend for the Rubik's Cube Solver app.

Phase-1 scope ONLY: securely proxy chat requests to DigitalOcean's
Serverless Inference API so the DO API key never reaches the browser.

No database, no auth, no cube-solving logic lives here yet.
"""
import os
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Rubik's Cube Coach API")

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class SolveContext(BaseModel):
    facelet_string: Optional[str] = None
    solution_moves: Optional[list[str]] = None
    mode: Optional[Literal["solve", "teach"]] = None
    completed_moves: int = Field(default=0, ge=0)
    front_color: Optional[str] = None
    top_color: Optional[str] = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[SolveContext] = None


class ChatResponse(BaseModel):
    reply: str


SYSTEM_PROMPT = (
    "You are a friendly, encouraging Rubik's cube coach. You explain moves in "
    "plain language and help the user understand what's happening on their "
    "cube. Keep replies concise (2-4 sentences) unless the user explicitly "
    "asks for more detail. When referencing specific moves, use standard "
    "cube notation (U, R, F, D, L, B, with ' for counterclockwise and 2 for "
    "double turns). Clockwise is always viewed directly at the face being turned. "
    "The deterministic solver, not you, computes and verifies the solution. "
    "Explain the provided moves without inventing or replacing them. A short "
    "Kociemba solution is not a beginner layer-by-layer method; do not claim "
    "each move completes a beginner stage. You cannot see camera images or "
    "diagnose sticker colors from text. Respect the given completed-move count "
    "and holding orientation. If context is insufficient, ask instead of guessing."
)


def _build_context_message(context: SolveContext) -> Optional[str]:
    """Summarize the optional solve context into a system message string.

    Only includes the sub-parts that are actually present.
    """
    parts: list[str] = []

    if context.facelet_string is not None:
        parts.append(
            "The user's starting cube state before any solution moves (facelet string, URFDLB order) "
            f"is: {context.facelet_string}."
        )
    if context.solution_moves is not None:
        parts.append(
            f"The planned solution moves are: {context.solution_moves}."
        )
    if context.mode is not None:
        parts.append(f"Current mode: {context.mode}.")
    parts.append(f"The user has completed {context.completed_moves} solution moves.")
    if context.front_color and context.top_color:
        parts.append(f"Hold the {context.front_color} center in front and the {context.top_color} center on top.")
    if context.solution_moves is not None:
        remaining = context.solution_moves[context.completed_moves:]
        parts.append(f"Next move: {remaining[0] if remaining else 'none; solution complete'}.")

    if not parts:
        return None

    return " ".join(parts)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/coach/chat", response_model=ChatResponse)
def coach_chat(chat_request: ChatRequest) -> ChatResponse:
    api_key = os.environ.get("DO_INFERENCE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500, detail="DO_INFERENCE_API_KEY is not configured"
        )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if chat_request.context is not None:
        context_message = _build_context_message(chat_request.context)
        if context_message is not None:
            messages.append({"role": "system", "content": context_message})

    messages.extend(
        {"role": m.role, "content": m.content} for m in chat_request.messages
    )

    client = OpenAI(
        base_url=os.environ.get("DO_INFERENCE_BASE_URL", "https://inference.do-ai.run/v1/"),
        api_key=api_key,
        timeout=30.0,
        max_retries=1,
    )

    try:
        completion = client.chat.completions.create(
            model=os.environ.get("DO_CHAT_MODEL", "anthropic-claude-haiku-4.5"),
            messages=messages,
            max_tokens=800,
        )
    except Exception:
        raise HTTPException(
            status_code=502, detail="The coach is unavailable. Check inference access and model configuration."
        )

    reply = completion.choices[0].message.content if completion.choices else None
    if not reply:
        raise HTTPException(status_code=502, detail="The coach returned an empty reply. Please try again.")
    return ChatResponse(reply=reply)
