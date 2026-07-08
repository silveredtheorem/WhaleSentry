import React from 'react'
import Header from './Header'

export default function Navbar({ bitcoinInfo, socketConnected, binanceConnected, darkMode, onToggleDarkMode }) {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 mb-6 -mx-4 sm:-mx-6 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="px-4 sm:px-6">
        <Header bitcoinInfo={bitcoinInfo} socketConnected={socketConnected} binanceConnected={binanceConnected} />
      </div>
      <button
        onClick={onToggleDarkMode}
        title="Toggle light/dark theme"
        className="shrink-0 mr-4 sm:mr-6 px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-gray-200"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </nav>
  )
}
