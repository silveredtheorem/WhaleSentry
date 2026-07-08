import React from 'react'
import { formatUSD } from '../utils/formatters'

export default function Leaderboard({ whales = [], limit = 10 }) {
  const top = [...whales].sort((a, b) => b.value - a.value).slice(0, limit)

  if (top.length === 0) return <p className="text-slate-500 dark:text-gray-500 text-sm text-center py-8">No whale trades yet.</p>

  return (
    <ol className="space-y-1.5">
      {top.map((w, i) => (
        <li key={w.id} className="flex justify-between items-center px-3 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 dark:text-gray-500 w-4 text-right">{i + 1}</span>
            <div>
              <div className="font-medium tabular-nums">{formatUSD(w.value)}</div>
              <div className="text-xs text-slate-500 dark:text-gray-500">{Number(w.quantity).toFixed(4)} BTC • {w.type}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-500">{w.time}</div>
        </li>
      ))}
    </ol>
  )
}
