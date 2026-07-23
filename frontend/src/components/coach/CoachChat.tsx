'use client'

import { useEffect, useRef, useState } from 'react'
import { sendCoachChatMessage, type CoachChatMessage } from '@/lib/backend'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isSeed?: boolean
  isError?: boolean
}

interface CoachChatProps {
  faceletString: string
  solutionMoves: string[]
}

export default function CoachChat({ faceletString, solutionMoves }: CoachChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'seed',
      role: 'assistant',
      content: 'Ask me why any move is needed, or anything else about your solve!',
      isSeed: true,
    },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || isSending) return

    const userMessage: DisplayMessage = { id: `${Date.now()}-u`, role: 'user', content: text }
    // Only real exchanged turns go to the backend — the seeded greeting and
    // any inline error bubbles are client-side only.
    const priorTurns = messages.filter((m) => !m.isSeed && !m.isError)

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    try {
      const payload: CoachChatMessage[] = [...priorTurns, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const reply = await sendCoachChatMessage(payload, {
        facelet_string: faceletString,
        solution_moves: solutionMoves,
        mode: 'solve',
      })
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: 'assistant',
          content: 'Coach is unavailable right now. Please try again in a bit.',
          isError: true,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-300 dark:border-zinc-700">
      <div className="border-b border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">AI Coach</div>
      <div ref={listRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-blue-600 text-white'
                : m.isError
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="flex gap-2 border-t border-zinc-300 p-2 dark:border-zinc-700"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach..."
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
