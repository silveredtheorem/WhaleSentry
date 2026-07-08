import React, { useEffect, useRef, useState, useCallback } from 'react'
import io from 'socket.io-client'
import axios from 'axios'

import StatsPanel from './components/StatsPanel'
import PriceChart from './components/PriceChart'
import WhaleAlert from './components/WhaleAlert'
import Leaderboard from './components/Leaderboard'
import TradesFeed from './components/TradesFeed'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InfoTip from './components/InfoTip'
import { exportWhalesCSV } from './utils/csvExport'
import { computeVWAP, accumulationDistribution, aggregateByInterval } from './utils/analytics'
import { filterByPair, tradeMatchesPair, deriveTokensFromPairs, getValidPartnersFor, splitPairSymbol } from './utils/pairMatcher'
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
  const [pairs, setPairs] = useState([])
  const [tokens, setTokens] = useState(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'XRP', 'SOL', 'DOT', 'LTC'])
  const [coinA, setCoinA] = useState('BTC')
  const [coinB, setCoinB] = useState('USDT')
  const coinARef = useRef(null)
  const coinBRef = useRef(null)
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
  const [detectionWindow, setDetectionWindow] = useState({ windowMs: 5000 })
  const msgCounter = useRef(0)
  const startedAt = useRef(Date.now())

  // Dark mode is real React state, not a one-time localStorage read. Persisting
  // happens in the effect below, so toggling re-renders immediately with no reload.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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
    socketRef.current.on('detection-window', (w) => setDetectionWindow(w))
    socketRef.current.on('detection-window-updated', (w) => setDetectionWindow(w))

    socketRef.current.on('history', history => {
      setTrades(history)
    })

    socketRef.current.on('pairs', (pList) => {
      const arr = Array.isArray(pList) ? pList : [pList]
      setPairs(arr)
      const tokArr = deriveTokensFromPairs(arr)
      setTokens(tokArr)
      // only update coins if not already set OR if current selection doesn't exist in new tokens
      if (tokArr.length >= 2) {
        const hasBTC = tokArr.includes('BTC')
        const hasUSDT = tokArr.includes('USDT')
        setCoinA(curr => tokArr.includes(curr) ? curr : (hasBTC ? 'BTC' : tokArr[0]))
        setCoinB(curr => tokArr.includes(curr) ? curr : (hasUSDT ? 'USDT' : tokArr[tokArr.length - 1]))
      }
    })

    socketRef.current.on('trade', trade => {
      msgCounter.current += 1
      setTrades(prev => {
        const updated = [...prev, trade]
        return updated.slice(-3600 * 4)
      })
      // only update price if trade matches selected pair
      if (coinARef.current && coinBRef.current) {
        const candidates = [`${coinARef.current}${coinBRef.current}`.toUpperCase(), `${coinBRef.current}${coinARef.current}`.toUpperCase()]
        if (trade.pair && candidates.includes(trade.pair.toUpperCase())) {
          setCurrentPrice(trade.price)
        }
      }
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

  // keep refs in sync with state
  useEffect(() => { coinARef.current = coinA }, [coinA])
  useEffect(() => { coinBRef.current = coinB }, [coinB])

  // when coinA changes and coinB is no longer a valid partner, pick the best available fallback
  useEffect(() => {
    if (!pairs.length) return
    const partners = getValidPartnersFor(coinA, pairs)
    if (!partners.includes(coinB)) {
      const preferred = ['USDT', 'BTC', 'ETH'].find(q => partners.includes(q)) ?? partners[0] ?? ''
      setCoinB(preferred)
    }
  }, [coinA, pairs])

  // valid Coin B choices given current Coin A and streamed pairs list
  const validCoinBOptions = pairs.length ? getValidPartnersFor(coinA, pairs) : tokens.filter(t => t !== coinA)

  // true only when the selected A/B combo corresponds to a real streamed pair
  const isPairValid = !pairs.length || pairs.some(p => {
    const up = String(p).toUpperCase()
    const a = String(coinA).toUpperCase()
    const b = String(coinB).toUpperCase()
    return up === a + b || up === b + a
  })

  // recompute priceHistory when trades or selected coins change
  useEffect(() => {
    if (!coinA || !coinB) return
    const filtered = filterByPair(trades, coinA, coinB)
    setPriceHistory(filtered.map(t => ({ time: t.time, price: t.price })))
    const latest = filtered.length ? filtered[filtered.length - 1] : null
    if (latest) setCurrentPrice(latest.price)
  }, [trades, coinA, coinB])

  const updateThresholds = (newThresh) => {
    setThresholds(newThresh)
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('set-thresholds', newThresh)
    }
  }

  const updateDetectionWindow = (window) => {
    setDetectionWindow(window)
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('set-detection-window', window)
    }
  }

  const chartData = {
    labels: priceHistory.map(t => t.time),
    datasets: [
      {
        label: coinA && coinB ? `${coinA}/${coinB}` : 'Price',
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
  // compute analytics from filtered trades (selected coin pair only)
  const filteredForAnalytics = coinA && coinB ? filterByPair(trades, coinA, coinB) : trades
  const vwap = computeVWAP(filteredForAnalytics, timeframeMs)
  const ad = accumulationDistribution(filteredForAnalytics, timeframeMs)
  const aggInterval = timeframe === '5m' ? 5*1000 : timeframe === '15m' ? 15*1000 : timeframe === '4h' ? 60*1000 : 60*1000
  const aggregatedSeries = aggregateByInterval(filteredForAnalytics.slice(-10000), aggInterval)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-4 sm:px-6 pb-6">
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" preload="auto" />

      <Navbar
        bitcoinInfo={bitcoinInfo}
        socketConnected={connected}
        binanceConnected={binanceConnected}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(d => !d)}
      />

      <div className="max-w-7xl mx-auto">
        {/* Floating whale toast */}
        {toast && (
          <div className="fixed right-6 top-20 z-[60] rounded-xl ring-1 ring-red-500/40 bg-white/95 dark:bg-slate-900/95 p-4 px-5 shadow-toast backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-2 text-base font-bold text-red-500 dark:text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {toast.whaleType} ALERT • {toast.type}
            </div>
            <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">{Number(toast.quantity).toFixed(4)} {toast.pair ? (splitPairSymbol(toast.pair)?.base ?? toast.pair) : 'COIN'} @ ${Number(toast.price).toLocaleString()} • {toast.time}</div>
          </div>
        )}

        <StatsPanel currentPrice={currentPrice} stats={{...stats, vwap}} dataPoints={priceHistory.length} />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
            Pair
            <select value={coinA || ''} onChange={e => setCoinA(e.target.value)} className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg text-sm text-slate-900 dark:text-white">
              {tokens.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-slate-400 dark:text-gray-600">/</span>
            <select value={coinB || ''} onChange={e => setCoinB(e.target.value)} className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg text-sm text-slate-900 dark:text-white">
              {validCoinBOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <InfoTip text="The trading pair to chart and filter trades/alerts by. Coin B options update based on which streams are live for the selected Coin A." />
            {!isPairValid && coinA && coinB && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">⚠ No live stream</span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
            Timeframe
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1.5 rounded-lg text-sm text-slate-900 dark:text-white">
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
            </select>
            <InfoTip text="Window used to compute VWAP and accumulation/distribution stats below the chart." />
          </label>
          <div className="ml-auto">
            <PerfPanel messagesPerSec={messagesPerSec} latencyMs={latencyMs} startTs={startedAt.current} />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-gray-400 shrink-0">
            Aggregation window (ms)
            <InfoTip text="How long trades are grouped together before their combined value is checked against the whale thresholds. Longer windows catch slow accumulation but raise fewer, later alerts." />
          </div>
          <input
            type="range"
            min="1000"
            max="60000"
            step="500"
            value={detectionWindow.windowMs || 5000}
            onChange={e => updateDetectionWindow({ windowMs: Number(e.target.value) })}
            className="flex-1 accent-cyan-500"
            title="Aggregation window in milliseconds: how long trades are grouped before checking the combined value against whale thresholds"
          />
          <div className="text-sm text-slate-700 dark:text-gray-300 min-w-fit">
            <span className="font-bold">{((detectionWindow.windowMs || 5000) / 1000).toFixed(1)}s</span>
          </div>
          <span className="text-xs text-slate-400 dark:text-gray-500 hidden sm:inline">Longer = fewer false alerts</span>
        </div>

        <PriceChart priceHistory={aggregatedSeries.length ? aggregatedSeries : priceHistory} vwap={vwap} darkMode={darkMode} label={coinA && coinB ? `${coinA}/${coinB}` : 'Price'} isPairValid={isPairValid} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <ThresholdsPanel thresholds={thresholds || {}} onThresholdChange={updateThresholds} />

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400">
              Accum/Dist
              <InfoTip text="Accumulation/Distribution: total buy volume vs. sell volume (in quote currency) over the selected timeframe. A positive net means more buying pressure." />
            </div>
            <div className="mt-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-500">Buy</span><span className="text-emerald-600 dark:text-emerald-400 font-medium">${ad.buyVol.toFixed(0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-500">Sell</span><span className="text-red-600 dark:text-red-400 font-medium">${ad.sellVol.toFixed(0)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800"><span className="text-slate-500 dark:text-gray-500">Net</span><span className="font-semibold">${ad.net.toFixed(0)}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Actions</div>
            <div className="mt-3 space-y-2">
              <button onClick={() => {
                const price = (thresholds && thresholds.WHALE) ? thresholds.WHALE : 10000
                const payload = { price, quantity: 1, type: 'BUY' }
                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit('test-whale', payload)
                } else {
                  fetch('/api/test-whale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                }
              }} title="Ask the backend to emit a real whale alert through the websocket, as if a live trade had crossed the WHALE threshold" className="w-full px-3 py-1.5 text-xs font-medium bg-pink-600 rounded-lg hover:bg-pink-500 transition-colors text-white">Test Alert</button>
              <button onClick={() => {
                const price = (thresholds && thresholds.WHALE) ? thresholds.WHALE : 10000
                const tq = { price, quantity: 1, value: price, timestamp: Date.now(), type: 'BUY', whaleType: 'WHALE', time: new Date().toLocaleTimeString(), id: `local-${Date.now()}` }
                setWhaleAlerts(prev => [tq, ...prev].slice(0,200))
                setToast(tq)
                setTimeout(()=>setToast(null), 6000)
              }} title="Show a local-only toast notification without involving the backend, useful for testing the UI alone" className="w-full px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Toast</button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-sm text-slate-500 dark:text-gray-400">Export</div>
            <div className="mt-3 space-y-2">
              <button onClick={downloadCSV} title="Download all currently tracked whale alerts as a CSV file" className="w-full px-3 py-1.5 text-xs font-medium bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors text-white">CSV</button>
              <button onClick={() => setWhaleAlerts([])} title="Clear the whale alert history shown on this page (does not affect the backend)" className="w-full px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Clear</button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <TradesFeed trades={trades} limit={80} coinA={coinA} coinB={coinB} />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">🚨 Whale Alerts</h2>
              {whaleAlerts.length === 0 ? (
                <p className="text-slate-500 dark:text-gray-500 text-sm text-center py-8">Monitoring for whales...</p>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto">
                  {(() => {
                    if (!coinA || !coinB) return whaleAlerts.map(w => <WhaleAlert key={w.id} whale={w} />)
                    const filtered = filterByPair(whaleAlerts, coinA, coinB)
                    return filtered.map(w => (
                      <WhaleAlert key={w.id} whale={w} />
                    ))
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">🏆 Leaderboard</h2>
            <Leaderboard whales={whaleAlerts} limit={10} />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default App
