import React from 'react'
import { formatUSD } from '../utils/formatters'
import { splitPairSymbol } from '../utils/pairMatcher'

export default function WhaleAlert({ whale }) {
  const emoji = whale.whaleType === 'MEGALODON' ? '🦈' : whale.whaleType === 'WHALE' ? '🐋' : '🐬'
  const major = whale.whaleType === 'MEGALODON'
  return (
    <div className={`p-3 rounded-lg border ${major ? 'border-red-400/60' : 'border-orange-400/60'} bg-slate-100 dark:bg-slate-800/60 animate-fade-in transition-transform duration-150 ease-out hover:-translate-y-0.5 ${major ? 'animate-shake' : ''} shadow-glow`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{emoji}</div>
          <div>
            <div className="text-lg font-bold tabular-nums [text-shadow:0_0_6px_rgba(0,212,255,0.12),0_0_12px_rgba(0,212,255,0.06)]">{formatUSD(whale.value)}</div>
            <div className="text-sm text-slate-500 dark:text-gray-400">
              {whale.tradeCount ? `${whale.tradeCount} trades • ` : ''}
              {whale.quantity ? `${Number(whale.quantity).toFixed(4)} ${whale.pair ? (splitPairSymbol(whale.pair)?.base ?? whale.pair) : 'COIN'} @ ${formatUSD(whale.price)}` : whale.pair}
            </div>
          </div>
        </div>
        <div className={`text-xs font-semibold px-3 py-1 rounded-full text-white ${whale.type === 'BUY' ? 'bg-emerald-600/80' : 'bg-red-600/80'}`}>{whale.type}</div>
      </div>
    </div>
  )
}
