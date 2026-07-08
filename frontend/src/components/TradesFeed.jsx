import React, { useEffect, useMemo, useRef, useState } from 'react'
import { formatUSD } from '../utils/formatters'
import { filterByPair, splitPairSymbol } from '../utils/pairMatcher'

const DEFAULT_RANGES = [
  { key: 'large', label: 'Large (>$100k)', min: 100000 },
  { key: 'medium', label: 'Medium ($10k-$100k)', min: 10000, max: 100000 },
  { key: 'small', label: 'Small (<$10k)', max: 10000 }
]

export default function TradesFeed({ trades = [], maxPerSection = 50, maxTotal = 2000, ranges = DEFAULT_RANGES, pairFilter = null, coinA = null, coinB = null }) {
  const [collapsed, setCollapsed] = useState({})
  const refs = useRef({})

  // ensure refs exist per range
  ranges.forEach(r => { if (!refs.current[r.key]) refs.current[r.key] = React.createRef() })

  // latest-first ordering, cap total buffered trades for performance
  const latest = useMemo(() => {
    const buffer = Math.max(maxTotal, maxPerSection * ranges.length * 2)
    let filtered = trades
    
    if (coinA && coinB) {
      // filter by exact coin pair
      filtered = filterByPair(trades, coinA, coinB)
    } else if (pairFilter) {
      if (Array.isArray(pairFilter)) {
        const set = new Set(pairFilter.map(p => String(p).toUpperCase()))
        filtered = trades.filter(t => t.pair && set.has(String(t.pair).toUpperCase()))
      } else {
        filtered = trades.filter(t => t.pair === pairFilter)
      }
    }
    
    return [...filtered].slice(-buffer).reverse()
  }, [trades, maxTotal, maxPerSection, ranges.length, pairFilter, coinA, coinB])

  // categorize and limit per-section
  const categorized = useMemo(() => {
    const out = {}
    ranges.forEach(r => out[r.key] = [])
    for (const t of latest) {
      const v = Number(t.value || (t.price * t.quantity) || 0)
      let placed = false
      for (const r of ranges) {
        const minOk = r.min == null ? true : v >= r.min
        const maxOk = r.max == null ? true : v < r.max
        if (minOk && maxOk) {
          // only keep up to maxPerSection per category
          if (out[r.key].length < maxPerSection) out[r.key].push(t)
          placed = true
          break
        }
      }
      if (!placed) {
        const fallbackKey = ranges[ranges.length-1].key
        if (out[fallbackKey].length < maxPerSection) out[fallbackKey].push(t)
      }
    }
    return out
  }, [latest, ranges, maxPerSection])

  // auto-scroll top of each section when trades update
  useEffect(() => {
    for (const r of ranges) {
      const el = refs.current[r.key] && refs.current[r.key].current
      if (el) el.scrollTop = 0
    }
  }, [latest, ranges])

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Trades</h2>
        <div className="text-xs text-slate-500 dark:text-gray-500">Showing latest on top</div>
      </div>

      {ranges.map(r => (
        <section key={r.key} className="mt-4 first:mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-600 dark:text-gray-300">{r.label} <span className="text-xs text-slate-500 dark:text-gray-500">({categorized[r.key]?.length || 0})</span></div>
            <button onClick={() => setCollapsed(prev => ({ ...prev, [r.key]: !prev[r.key] }))} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{collapsed[r.key] ? 'Expand' : 'Collapse'}</button>
          </div>

          {!collapsed[r.key] && (
            <ul ref={refs.current[r.key]} className="space-y-1 max-h-44 overflow-y-auto">
              {categorized[r.key] && categorized[r.key].length === 0 && (
                <li className="text-xs text-slate-500 dark:text-gray-500 px-2 py-2">No trades in this range</li>
              )}
              {categorized[r.key] && categorized[r.key].map(t => (
                <li key={`${t.timestamp}-${t.price}-${t.quantity}-${Math.random()}`} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${t.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-700/40 dark:text-red-300'}`}>{t.type}</div>
                    <div className="text-sm">
                      <div className="font-medium">{Number(t.quantity).toFixed(4)} {t.pair ? (splitPairSymbol(t.pair)?.base ?? t.pair) : 'COIN'}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-500">{t.time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{formatUSD(t.price)}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-500 tabular-nums">{formatUSD(t.value)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
