import React, { useEffect, useState } from 'react'
import InfoTip from './InfoTip'

export default function PerfPanel({ messagesPerSec, latencyMs, startTs }) {
  const [uptime, setUptime] = useState('0s')

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startTs) / 1000)
      if (s < 60) setUptime(`${s}s`)
      else if (s < 3600) setUptime(`${Math.floor(s/60)}m`)
      else setUptime(`${Math.floor(s/3600)}h`)
    }, 1000)
    return () => clearInterval(t)
  }, [startTs])

  return (
    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
      <div className="flex items-center gap-1">
        Msgs/s <span className="font-bold text-slate-900 dark:text-white tabular-nums">{messagesPerSec}</span>
        <InfoTip text="Trade messages received from the backend over the last second, across all subscribed pairs." />
      </div>
      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
      <div className="flex items-center gap-1">
        Latency <span className="font-bold text-slate-900 dark:text-white tabular-nums">{latencyMs ? `${latencyMs}ms` : '—'}</span>
        <InfoTip text="Round-trip time of a websocket ping/pong to the backend, in milliseconds." />
      </div>
      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
      <div className="flex items-center gap-1">
        Uptime <span className="font-bold text-slate-900 dark:text-white tabular-nums">{uptime}</span>
        <InfoTip text="How long this browser tab has been connected, not the backend's uptime." />
      </div>
    </div>
  )
}
