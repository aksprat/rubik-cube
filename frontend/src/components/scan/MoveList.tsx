'use client'

interface MoveListProps {
  moves: string[]
  currentIndex: number
  onSelectIndex: (index: number) => void
}

export default function MoveList({ moves, currentIndex, onSelectIndex }: MoveListProps) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {moves.map((move, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onSelectIndex(i)}
            className={`w-full rounded border px-2 py-1.5 text-center font-mono text-sm transition-colors ${
              i === currentIndex
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-zinc-300 bg-white text-zinc-800 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
            }`}
          >
            <span className="block text-[10px] opacity-60">{i + 1}</span>
            {move}
          </button>
        </li>
      ))}
    </ol>
  )
}
