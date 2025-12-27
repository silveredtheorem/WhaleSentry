import React from 'react'
import { formatUSD } from '../utils/formatters'

export default function StatsPanel({ currentPrice, stats, dataPoints }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card label="Price" value={formatUSD(currentPrice)} />
      <Card label="Whales" value={stats.whaleCount} />
      <Card label="VWAP" value={stats.vwap ? formatUSD(stats.vwap) : '-'} />
      <Card label="Data Points" value={dataPoints} />
    </div>
  )
}

function Card({ label, value, sub }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-2">{value} {sub && <span className="text-xs text-gray-400">{sub}</span>}</p>
    </div>
  )
}
