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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

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
