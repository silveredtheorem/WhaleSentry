import React from 'react'
import { Line } from 'react-chartjs-2'

export default function PriceChart({ priceHistory, vwap = null, darkMode = true, label = 'Price', isPairValid = true }) {
  const labels = priceHistory.map(t => t.time)
  const priceData = priceHistory.map(t => t.price)

  const datasets = [
    {
      label,
      data: priceData,
      borderColor: '#00d4ff',
      backgroundColor: 'rgba(0,212,255,0.06)',
      fill: true,
      tension: 0.24,
      pointRadius: 0
    }
  ]

  if (vwap) {
    // repeat vwap value across labels (ChartJS handles dataset of same length)
    const vwapSeries = new Array(labels.length).fill(Number(vwap.toFixed(2)))
    datasets.push({
      label: 'VWAP',
      data: vwapSeries,
      borderColor: '#00ff88',
      borderDash: [6,4],
      pointRadius: 0,
      tension: 0
    })
  }

  const chartData = { labels, datasets }

  // Chart.js renders to <canvas>, which Tailwind's dark: variant can't reach,
  // so the legend/axis colors are switched explicitly based on the current theme.
  const tickColor = darkMode ? '#94a3b8' : '#475569'
  const legendColor = darkMode ? '#cbd5e1' : '#334155'
  const options = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: legendColor } } },
    scales: {
      x: { ticks: { color: tickColor } },
      y: { ticks: { color: tickColor } }
    }
  }

  const emptyMessage = priceHistory.length === 0
    ? (isPairValid ? 'Waiting for trades — this pair has low volume' : 'No live stream for this pair')
    : null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">📈 Price Chart (rolling window)</h2>
      <div className="relative h-[420px]">
        {emptyMessage && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-gray-500 text-sm">
            {emptyMessage}
          </div>
        )}
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
