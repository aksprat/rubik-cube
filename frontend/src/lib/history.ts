// Client-side solve history, persisted to localStorage. No backend/database
// involved — matches the app's offline-first design.
import type { FaceletString } from './cube/types'

export interface SolveHistoryEntry {
  id: string
  faceletString: FaceletString
  solutionMoves: string[]
  timestamp: string // ISO 8601
  elapsedMs?: number // capture-start to solution-ready, if tracked
}

const STORAGE_KEY = 'rubik-solve-history'
const MAX_ENTRIES = 50

export function loadSolveHistory(): SolveHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SolveHistoryEntry[]) : []
  } catch {
    return []
  }
}

export function saveSolveToHistory(entry: Omit<SolveHistoryEntry, 'id'>): SolveHistoryEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = loadSolveHistory()
    const withId: SolveHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
    const next = [withId, ...existing].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return withId
  } catch {
    // Storage can fail (quota, privacy mode, etc.) — losing history isn't
    // fatal, so just skip persisting rather than crashing the solve flow.
    return null
  }
}
