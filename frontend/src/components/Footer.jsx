import React from 'react'

export default function Footer() {
  return (
    <footer className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-gray-500 flex flex-wrap items-center justify-between gap-2">
      <div>Data via Binance WebSocket (public trade stream)</div>
      <a
        href="https://github.com/silveredtheorem/WhaleSentry"
        target="_blank"
        rel="noreferrer"
        className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
      >
        View source on GitHub
      </a>
    </footer>
  )
}
