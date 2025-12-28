import React from 'react'
import { formatUSD } from '../utils/formatters'

export default function WhaleAlert({ whale }) {
  const emoji = whale.whaleType === 'MEGALODON' ? '🦈' : whale.whaleType === 'WHALE' ? '🐋' : '🐬'
  const major = whale.whaleType === 'MEGALODON'
  return (
    <div className={`p-3 rounded-lg border ${major ? 'border-red-400' : 'border-orange-400'} bg-gradient-to-br from-[#071028] to-[#0b1220] fade-in card-hover ${major ? 'shake' : ''} glow-border`}> 
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{emoji}</div>
          <div>
            <div className="text-lg font-bold neon">{formatUSD(whale.value)}</div>
            <div className="text-sm text-gray-400">
              {whale.tradeCount ? `${whale.tradeCount} trades • ` : ''}
              {whale.quantity ? `${Number(whale.quantity).toFixed(4)} ${whale.pair ? whale.pair.replace('USDT','') : 'COIN'} @ ${formatUSD(whale.price)}` : whale.pair}
            </div>
          </div>
        </div>
        <div className={`${whale.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'} px-3 py-1 rounded`}>{whale.type}</div>
      </div>
    </div>
  )
}
