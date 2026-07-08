import React from 'react'
import { formatUSD } from '../utils/formatters'
import InfoTip from './InfoTip'

export default function StatsPanel({ currentPrice, stats, dataPoints }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card label="Price" value={formatUSD(currentPrice)} help="Last traded price for the selected pair, in USD." />
      <Card label="Whales" value={stats.whaleCount} help="Count of whale alerts (trades or aggregated trade groups over the DOLPHIN/WHALE/MEGALODON thresholds) seen this session." />
      <Card label="VWAP" value={stats.vwap ? formatUSD(stats.vwap) : '-'} help="Volume-Weighted Average Price: average trade price over the selected timeframe, weighted by trade size." />
      <Card label="Data Points" value={dataPoints} help="Number of price samples currently plotted on the chart for the selected pair." />
    </div>
  )
}

function Card({ label, value, sub, help }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 text-sm">
        {label}
        {help && <InfoTip text={help} />}
      </p>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value} {sub && <span className="text-xs text-slate-500 dark:text-gray-400">{sub}</span>}</p>
    </div>
  )
}
