import React, { useEffect, useState } from 'react'
import { formatUSD } from '../utils/formatters'

export default function ThresholdsPanel({ thresholds = {}, onChange }) {
  const [local, setLocal] = useState({
    DOLPHIN: thresholds.DOLPHIN || 1000,
    WHALE: thresholds.WHALE || 10000,
    MEGALODON: thresholds.MEGALODON || 50000
  })

  useEffect(() => setLocal({
    DOLPHIN: thresholds.DOLPHIN || local.DOLPHIN,
    WHALE: thresholds.WHALE || local.WHALE,
    MEGALODON: thresholds.MEGALODON || local.MEGALODON
  }), [thresholds])

  function update(key, value) {
    const v = Number(value)
    setLocal(prev => ({ ...prev, [key]: v }))
    if (onChange) onChange({ ...local, [key]: v })
  }

  return (
    <div className="bg-gradient-to-br from-[#071028] to-[#081428] rounded-xl p-4 glow-border">
      <h3 className="text-lg mb-3">Thresholds</h3>
      <div className="space-y-4">
        {['DOLPHIN','WHALE','MEGALODON'].map(key => (
          <div key={key} className="">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">{key}</div>
              <div className="text-sm text-gray-300">{formatUSD(local[key])}</div>
            </div>
            <input type="range" min="100" max="1000000" step="100" value={local[key]} onChange={e => update(key, e.target.value)} className="w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
