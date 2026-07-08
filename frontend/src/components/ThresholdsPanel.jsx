import React, { useEffect, useState } from 'react'
import { formatUSD } from '../utils/formatters'
import InfoTip from './InfoTip'

const HELP_TEXT = {
  DOLPHIN: 'Minimum trade value (USD) to be flagged as a small "Dolphin" alert.',
  WHALE: 'Minimum trade value (USD) to be flagged as a "Whale" alert.',
  MEGALODON: 'Minimum trade value (USD) to be flagged as the largest "Megalodon" alert.'
}

export default function ThresholdsPanel({ thresholds = {}, onThresholdChange }) {
  const [local, setLocal] = useState({
    DOLPHIN: thresholds.DOLPHIN || 200000,
    WHALE: thresholds.WHALE || 500000,
    MEGALODON: thresholds.MEGALODON || 1000000
  })

  useEffect(() => setLocal({
    DOLPHIN: thresholds.DOLPHIN || local.DOLPHIN,
    WHALE: thresholds.WHALE || local.WHALE,
    MEGALODON: thresholds.MEGALODON || local.MEGALODON
  }), [thresholds])

  function updateThreshold(key, value) {
    const v = Number(value)
    setLocal(prev => ({ ...prev, [key]: v }))
    if (onThresholdChange) onThresholdChange({ ...local, [key]: v })
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-glow">
      <h3 className="text-sm text-slate-500 dark:text-gray-400 mb-3">Thresholds (USD)</h3>
      <div className="space-y-4">
        {['DOLPHIN','WHALE','MEGALODON'].map(key => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {key}
                <InfoTip text={HELP_TEXT[key]} />
              </div>
              <div className="text-sm text-slate-600 dark:text-gray-300 tabular-nums">{formatUSD(local[key])}</div>
            </div>
            <input
              type="range"
              min="100"
              max="1000000"
              step="100"
              value={local[key]}
              onChange={e => updateThreshold(key, e.target.value)}
              title={HELP_TEXT[key]}
              className="w-full accent-cyan-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
