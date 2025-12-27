import React from 'react'
import { Line } from 'react-chartjs-2'

export default function PriceChart({ priceHistory, vwap = null }) {
  const labels = priceHistory.map(t => t.time)
  const priceData = priceHistory.map(t => t.price)

  const datasets = [
    {
      label: 'BTC Price',
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

  const options = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
    scales: {
      x: { ticks: { color: '#94a3b8' } },
      y: { ticks: { color: '#94a3b8' } }
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 mb-8">
      <h2 className="text-xl mb-4">📈 Price Chart (rolling window)</h2>
      <div style={{ height: '420px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
