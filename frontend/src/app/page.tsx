import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rubik&apos;s Cube Solver</h1>
          <p className="text-base text-zinc-500">
            Scan your physical cube with your phone camera, get an optimal solution, and step through it with an AI
            coach that explains every move.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/scan"
            className="w-full rounded-md bg-blue-600 px-5 py-3 text-center font-medium text-white hover:bg-blue-700"
          >
            Start Scan
          </Link>
          <Link
            href="/history"
            className="w-full rounded-md border border-zinc-300 px-5 py-3 text-center font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            View past solves
          </Link>
        </div>

        <p className="text-xs text-zinc-400">3x3 cubes only for now. Works best on a phone with a rear camera.</p>
      </div>
    </main>
  )
}
