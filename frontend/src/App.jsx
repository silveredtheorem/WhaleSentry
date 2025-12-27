import React, { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import axios from 'axios'

import Header from './components/Header'
import StatsPanel from './components/StatsPanel'
import PriceChart from './components/PriceChart'
import WhaleAlert from './components/WhaleAlert'
import Leaderboard from './components/Leaderboard'
import TradesFeed from './components/TradesFeed'
import { exportWhalesCSV } from './utils/csvExport'
import { computeVWAP, accumulationDistribution, aggregateByInterval } from './utils/analytics'
import PerfPanel from './components/PerfPanel'
import ThresholdsPanel from './components/ThresholdsPanel'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function App() {
  const [connected, setConnected] = useState(false)
  const [binanceConnected, setBinanceConnected] = useState(false)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [priceHistory, setPriceHistory] = useState([])
  const [trades, setTrades] = useState([]) // full trade objects
  const [whaleAlerts, setWhaleAlerts] = useState([])
  const [toast, setToast] = useState(null)
  const [stats, setStats] = useState({ totalVolume: 0, whaleCount: 0 })
  const [bitcoinInfo, setBitcoinInfo] = useState(null)
  const [thresholds, setThresholds] = useState(null)
  const socketRef = useRef(null)
  const audioRef = useRef(null)
  const audioMap = useRef({
    DOLPHIN: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
    WHALE: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    MEGALODON: 'https://actions.google.com/sounds/v1/alarms/warning_1.ogg'
  })

  const [timeframe, setTimeframe] = useState('1h')
  const [messagesPerSec, setMessagesPerSec] = useState(0)
  const [latencyMs, setLatencyMs] = useState(null)
  const msgCounter = useRef(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    axios.get('https://api.coingecko.com/api/v3/coins/bitcoin')
      .then(res => {
        const data = res.data
        setBitcoinInfo({ logo: data.image.small, symbol: data.symbol.toUpperCase(), name: data.name, priceChange24h: data.market_data.price_change_percentage_24h })
      }).catch(() => {})

    socketRef.current = io('http://localhost:3000')
    socketRef.current.on('connect', () => setConnected(true))
    socketRef.current.on('disconnect', () => setConnected(false))
    socketRef.current.on('connection-status', (s) => {
      // s = { connected: boolean }
      setBinanceConnected(Boolean(s && s.connected))
    })
    socketRef.current.on('thresholds', (t) => setThresholds(t))
    socketRef.current.on('thresholds-updated', (t) => setThresholds(t))

    socketRef.current.on('history', history => {
      setTrades(history)
      setPriceHistory(history.map(t => ({ time: t.time, price: t.price })))
    })

    socketRef.current.on('trade', trade => {
      msgCounter.current += 1
      setCurrentPrice(trade.price)
      setTrades(prev => {
        const updated = [...prev, trade]
        return updated.slice(-3600 * 4)
      })
      setPriceHistory(prev => {
        const updated = [...prev, { time: trade.time, price: trade.price }]
        return updated.slice(-3600)
      })
    })

    socketRef.current.on('whale-alert', whale => {
      setWhaleAlerts(prev => [whale, ...prev].slice(0, 200))
      setStats(prev => ({ totalVolume: prev.totalVolume + whale.value, whaleCount: prev.whaleCount + 1 }))
      // play audio cue based on whaleType
      const src = audioMap.current[whale.whaleType] || audioMap.current.DOLPHIN
      const a = new Audio(src)
      a.play().catch(()=>{})
      // show floating toast for immediate attention
      setToast(whale)
      setTimeout(() => setToast(null), 8000)
    })

    const rateInterval = setInterval(() => {
      setMessagesPerSec(msgCounter.current)
      msgCounter.current = 0
    }, 1000)

    const pingInterval = setInterval(() => {
      const t0 = Date.now()
      socketRef.current.emit('ping', (res) => {
        const rtt = Date.now() - t0
        setLatencyMs(rtt)
      })
    }, 5000)

    return () => {
      clearInterval(rateInterval)
      clearInterval(pingInterval)
      socketRef.current && socketRef.current.disconnect()
    }
  }, [])

  const updateThresholds = (newThresh) => {
    setThresholds(newThresh)
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('set-thresholds', newThresh)
    }
  }

  const chartData = {
    labels: priceHistory.map(t => t.time),
    datasets: [
      {
        label: 'BTC Price',
        data: priceHistory.map(t => t.price),
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.08)',
        fill: true,
        tension: 0.3
      }
    ]
  }

  const downloadCSV = () => {
    exportWhalesCSV(whaleAlerts, `whale-alerts-${Date.now()}.csv`)
  }

  const timeframeMs = timeframe === '5m' ? 5*60*1000 : timeframe === '15m' ? 15*60*1000 : timeframe === '4h' ? 4*60*60*1000 : 60*60*1000
  const vwap = computeVWAP(trades, timeframeMs)
  const ad = accumulationDistribution(trades, timeframeMs)
  const aggInterval = timeframe === '5m' ? 5*1000 : timeframe === '15m' ? 15*1000 : timeframe === '4h' ? 60*1000 : 60*1000
  const aggregatedSeries = aggregateByInterval(trades.slice(-10000), aggInterval)

  return (
    <div className={`min-h-screen text-white p-6 ${localStorage.getItem('theme') === 'dark' ? 'theme-dark' : ''}`}>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" />
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Header bitcoinInfo={bitcoinInfo} connected={connected} />
          <div className="flex items-center gap-2">
            <button onClick={() => { const t = localStorage.getItem('theme') === 'dark' ? '' : 'dark'; localStorage.setItem('theme', t); document.location.reload(); }} className="px-3 py-1 bg-slate-800 rounded">Toggle Dark</button>
          </div>
        </div>

        {/* Floating whale toast */}
        {toast && (
          <div className="whale-toast fade-in">
            <div className="title">{toast.whaleType} ALERT • {toast.type}</div>
            <div className="sub">{Number(toast.quantity).toFixed(4)} BTC @ ${Number(toast.price).toLocaleString()} • {toast.time}</div>
          </div>
        )}

        <StatsPanel currentPrice={currentPrice} stats={{...stats, vwap}} dataPoints={priceHistory.length} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <ThresholdsPanel thresholds={thresholds || {}} onChange={updateThresholds} />
          </div>
          <div>
            <div className="bg-slate-900 rounded-xl p-4">
              <div className="text-sm text-gray-400">Accum/Dist</div>
              <div className="mt-2">Buy: ${ad.buyVol.toFixed(0)} • Sell: ${ad.sellVol.toFixed(0)} • Net: ${ad.net.toFixed(0)}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          <button onClick={() => {
            const price = (thresholds && thresholds.WHALE) ? thresholds.WHALE : 10000
            const payload = { price, quantity: 1, type: 'BUY' }
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit('test-whale', payload)
            } else {
              // fallback to HTTP POST
              fetch('/api/test-whale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            }
          }} className="px-4 py-2 bg-pink-600 rounded hover:bg-pink-500 text-white">Test Whale Alert</button>
          <button onClick={() => {
            // small visual sample: produce a local toast mimic
            const price = (thresholds && thresholds.WHALE) ? thresholds.WHALE : 10000
            const tq = { price, quantity: 1, value: price, timestamp: Date.now(), type: 'BUY', whaleType: 'WHALE', time: new Date().toLocaleTimeString(), id: `local-${Date.now()}` }
            setWhaleAlerts(prev => [tq, ...prev].slice(0,200))
            setToast(tq)
            setTimeout(()=>setToast(null), 6000)
          }} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-white">Local Toast</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="text-sm text-gray-300">Timeframe:</div>
          <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="bg-slate-900 p-2 rounded">
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
          </select>
          <div className="ml-auto text-sm text-gray-400">Msgs/s: {messagesPerSec} • Latency: {latencyMs ? `${latencyMs}ms` : '—'}</div>
        </div>

        <PriceChart priceHistory={aggregatedSeries.length ? aggregatedSeries : priceHistory} vwap={vwap} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            {/* Alerts panel already below */}
          </div>
          <div>
            <PerfPanel messagesPerSec={messagesPerSec} latencyMs={latencyMs} startTs={startedAt.current} />
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <button onClick={downloadCSV} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">Export CSV</button>
          <button onClick={() => setWhaleAlerts([])} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Clear Alerts</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <TradesFeed trades={trades} limit={80} />

              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-xl mb-4">🚨 Whale Alerts</h2>
                {whaleAlerts.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Monitoring for whales...</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto">
                    {whaleAlerts.map(w => (
                      <WhaleAlert key={w.id} whale={w} />
                    ))}
                  </div>
                )}
              </div>
            </div>

          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl mb-4">🏆 Leaderboard</h2>
            <Leaderboard whales={whaleAlerts} limit={10} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4">
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}

function WhaleCard({ whale }) {
  const emoji = whale.whaleType === 'MEGALODON' ? '🦈' : whale.whaleType === 'WHALE' ? '🐋' : '🐬'
  return (
    <div className={`p-3 rounded-lg border ${whale.whaleType === 'MEGALODON' ? 'border-red-500' : 'border-orange-500'} bg-[#071028]`}> 
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{emoji}</div>
          <div>
            <div className="text-lg font-bold">${Number(whale.value).toLocaleString()}</div>
            <div className="text-sm text-gray-400">{Number(whale.quantity).toFixed(4)} BTC @ ${Number(whale.price).toLocaleString()}</div>
          </div>
        </div>
        <div className={`${whale.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'} px-3 py-1 rounded`}>{whale.type}</div>
      </div>
    </div>
  )
}

export default App
