// Thin client for the one backend endpoint this app calls: the AI coach
// chat proxy. Everything else (scanning, classification, validation,
// solving) stays fully client-side.
export interface CoachChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CoachChatContext {
  facelet_string?: string
  solution_moves?: string[]
  mode?: 'solve' | 'teach'
}

// No default here on purpose: in production the frontend and backend share one
// domain via path-based ingress routing, so a relative '' (same-origin '/api/...')
// is correct. Local dev sets an explicit absolute URL via .env.local instead,
// since there's no shared domain between the two separate dev servers.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export async function sendCoachChatMessage(
  messages: CoachChatMessage[],
  context?: CoachChatContext
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/coach/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  })

  if (!res.ok) {
    throw new Error(`Coach request failed with status ${res.status}`)
  }

  const data: unknown = await res.json()
  const reply = (data as { reply?: unknown } | null)?.reply
  if (typeof reply !== 'string') {
    throw new Error('Coach response was missing a reply')
  }
  return reply
}
