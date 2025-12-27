import React, { useEffect, useState } from 'react'

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
    <div className="bg-slate-900 rounded-xl p-4">
      <p className="text-gray-400 text-sm">Performance</p>
      <div className="mt-2 flex gap-4 text-sm">
        <div><span className="font-semibold">Msgs/s:</span> {messagesPerSec}</div>
        <div><span className="font-semibold">Latency:</span> {latencyMs ? `${latencyMs}ms` : '—'}</div>
        <div><span className="font-semibold">Uptime:</span> {uptime}</div>
      </div>
    </div>
  )
}
