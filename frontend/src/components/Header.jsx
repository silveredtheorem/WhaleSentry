import React from 'react'

function StatusDot({ label, ok }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 px-3 py-1.5">
      <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'} ${ok ? '' : 'animate-pulse'}`} />
      <span className="text-xs font-medium text-slate-600 dark:text-gray-300">{label}</span>
    </div>
  )
}

export default function Header({ bitcoinInfo, socketConnected, binanceConnected }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {bitcoinInfo
          ? <img src={bitcoinInfo.logo} alt="BTC" className="w-11 h-11 rounded-full ring-1 ring-slate-300 dark:ring-slate-800" />
          : <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">🐋 Whale Sentry 3000</h1>
          <p className="text-slate-500 dark:text-gray-500 text-sm">Real-time multi-pair whale detection</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusDot label="Socket" ok={socketConnected} />
        <StatusDot label="Binance" ok={binanceConnected} />
      </div>
    </header>
  )
}
