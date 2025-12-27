import React from 'react'

export default function Header({ bitcoinInfo, socketConnected, binanceConnected }) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {bitcoinInfo && <img src={bitcoinInfo.logo} alt="BTC" className="w-12 h-12" />}
        <div>
          <h1 className="text-3xl font-semibold">🐋 Whale Sentry 3000</h1>
          <p className="text-gray-400 text-sm">Real-Time BTC/USDT trade detection</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-red-500'} animate-pulse`} />
          <div className="text-sm">Socket</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${binanceConnected ? 'bg-green-400' : 'bg-yellow-500'} animate-pulse`} />
          <div className="text-sm">Binance</div>
        </div>
      </div>
    </header>
  )
}
