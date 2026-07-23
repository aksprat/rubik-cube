'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadSolveHistory, type SolveHistoryEntry } from '@/lib/history'
import TwistyCube from '@/components/cube/TwistyCube'

export default function HistoryPage() {
  // Deliberately *not* lazy-initial-state here: this page is statically
  // prerendered, and localStorage genuinely differs between that prerender
  // (no window) and the real client. Reading it in an effect (after mount,
  // before paint of real data) avoids a server/client hydration mismatch;
  // reading it during the lazy render would fix a lint nit at the cost of
  // that correctness.
  const [entries, setEntries] = useState<SolveHistoryEntry[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: see comment above
    setEntries(loadSolveHistory())
  }, [])

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Solve history</h1>
        <Link href="/scan" className="text-sm text-blue-600 underline underline-offset-2">
          New scan
        </Link>
      </div>

      {entries === null && <p className="text-sm text-zinc-500">Loading…</p>}

      {entries?.length === 0 && (
        <p className="text-sm text-zinc-500">
          No solves yet.{' '}
          <Link href="/scan" className="underline underline-offset-2">
            Scan a cube
          </Link>{' '}
          to get started.
        </p>
      )}

      <ul className="space-y-3">
        {entries?.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{new Date(entry.timestamp).toLocaleString()}</p>
                <p className="text-xs text-zinc-500">
                  {entry.solutionMoves.length} moves
                  {typeof entry.elapsedMs === 'number'
                    ? ` · ${Math.round(entry.elapsedMs / 1000)}s scan-to-solve`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                className="shrink-0 text-sm text-blue-600 underline underline-offset-2"
              >
                {expandedId === entry.id ? 'Hide' : 'View'}
              </button>
            </div>
            {expandedId === entry.id && (
              <div className="mt-3 space-y-2">
                <TwistyCube solutionMoves={entry.solutionMoves} />
                <p className="break-all font-mono text-xs text-zinc-500">{entry.faceletString}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
