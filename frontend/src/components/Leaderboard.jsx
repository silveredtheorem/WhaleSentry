import React from 'react'
import { formatUSD } from '../utils/formatters'

export default function Leaderboard({ whales = [], limit = 10 }) {
  const top = [...whales].sort((a, b) => b.value - a.value).slice(0, limit)

  if (top.length === 0) return <p className="text-gray-400">No whale trades yet.</p>

  return (
    <ol className="space-y-2">
      {top.map((w, i) => (
        <li key={w.id} className="flex justify-between items-center px-2 py-2 bg-[#071028] rounded">
          <div>
            <div className="font-medium">{i+1}. {formatUSD(w.value)}</div>
            <div className="text-xs text-gray-400">{Number(w.quantity).toFixed(4)} BTC • {w.type}</div>
          </div>
          <div className="text-sm text-gray-300">{w.time}</div>
        </li>
      ))}
    </ol>
  )
}
