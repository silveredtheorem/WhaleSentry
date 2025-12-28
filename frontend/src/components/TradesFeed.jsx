import React, { useEffect, useMemo, useRef, useState } from 'react'
import { formatUSD } from '../utils/formatters'

const DEFAULT_RANGES = [
  { key: 'large', label: 'Large (>$100k)', min: 100000 },
  { key: 'medium', label: 'Medium ($10k-$100k)', min: 10000, max: 100000 },
  { key: 'small', label: 'Small (<$10k)', max: 10000 }
]

export default function TradesFeed({ trades = [], maxPerSection = 50, maxTotal = 2000, ranges = DEFAULT_RANGES, pairFilter = null }) {
  const [collapsed, setCollapsed] = useState({})
  const refs = useRef({})

  // ensure refs exist per range
  ranges.forEach(r => { if (!refs.current[r.key]) refs.current[r.key] = React.createRef() })

  // latest-first ordering, cap total buffered trades for performance
  const latest = useMemo(() => {
    const buffer = Math.max(maxTotal, maxPerSection * ranges.length * 2)
    let filtered = trades
    if (pairFilter) {
      if (Array.isArray(pairFilter)) {
        const set = new Set(pairFilter.map(p => String(p).toUpperCase()))
        filtered = trades.filter(t => t.pair && set.has(String(t.pair).toUpperCase()))
      } else {
        filtered = trades.filter(t => t.pair === pairFilter)
      }
    }
    return [...filtered].slice(-buffer).reverse()
  }, [trades, maxTotal, maxPerSection, ranges.length, pairFilter])

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
    <div className="bg-slate-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg">Live Trades</h3>
        <div className="text-sm text-gray-400">Showing latest on top</div>
      </div>

      {ranges.map(r => (
        <section key={r.key} className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">{r.label} <span className="text-xs text-gray-400">({categorized[r.key]?.length || 0})</span></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCollapsed(prev => ({ ...prev, [r.key]: !prev[r.key] }))} className="text-xs px-2 py-1 bg-slate-900 rounded">{collapsed[r.key] ? 'Expand' : 'Collapse'}</button>
            </div>
          </div>

          {!collapsed[r.key] && (
            <ul ref={refs.current[r.key]} className="space-y-2 max-h-44 overflow-y-auto">
              {categorized[r.key] && categorized[r.key].length === 0 && (
                <li className="text-xs text-gray-400">No trades in this range</li>
              )}
              {categorized[r.key] && categorized[r.key].map(t => (
                <li key={`${t.timestamp}-${t.price}-${t.quantity}-${Math.random()}`} className="flex justify-between items-center p-2 rounded hover:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs ${t.type === 'BUY' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>{t.type}</div>
                    <div className="text-sm">
                      <div className="font-medium">{Number(t.quantity).toFixed(4)} {t.pair ? t.pair.replace('USDT','') : 'COIN'}</div>
                      <div className="text-xs text-gray-400">{t.time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatUSD(t.price)}</div>
                    <div className="text-xs text-gray-400">{formatUSD(t.value)}</div>
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
