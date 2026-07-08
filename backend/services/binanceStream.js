const WebSocket = require('ws')
const { classify, classifyByZScore, classifyComposite } = require('./whaleDetector')
const { update: updateStats, zScore } = require('./rollingStats')
const { updateDepth, getImbalance } = require('./depthTracker')
const { insertWhalesBatch } = require('./db')
const { TradeQueue } = require('./tradeQueue')

let WINDOW_MS = Number(process.env.AGG_WINDOW_MS) || 5000
const MIN_EMIT_GAP_MS    = Number(process.env.MIN_EMIT_GAP_MS)            || 5000
const CONSUMER_INTERVAL_MS = Number(process.env.TRADE_CONSUMER_INTERVAL_MS) || 50

function setWindowMs(ms) {
  WINDOW_MS = Math.max(1000, Math.min(60000, Number(ms) || 5000))
  console.log(`⏱️  Detection window → ${WINDOW_MS}ms`)
  return WINDOW_MS
}
function getWindowMs() { return WINDOW_MS }

const buffers = {}  // pair → [{ value, timestamp, price, quantity, type }]
const lastEmit = {} // pair → timestamp of last aggregated alert

const queue = new TradeQueue()
let consumerStarted = false
let _binanceConnected = false

function getQueueMetrics()    { return queue.getMetrics() }
function getBinanceConnected() { return _binanceConnected }

// Exponential backoff with full jitter.
// delay(0)=1s±0.5s, delay(1)=2s±1s, … capped at 30s.
// Full jitter (random in [0, computed_cap]) prevents thundering-herd
// when many clients reconnect simultaneously after a service outage.
function _backoffMs(attempt) {
  const cap = Math.min(30_000, 1_000 * Math.pow(2, attempt))
  return Math.random() * cap
}

function _safePair(p) { return String(p || '').toLowerCase() }

function startConsumer(io, recentTrades, MAX_HISTORY) {
  if (consumerStarted) return
  consumerStarted = true

  setInterval(async () => {
    const items = queue.drainAll()
    if (!items.length) return

    const whaleBatch = []
    let totalLag = 0

    for (const item of items) {
      totalLag += Date.now() - item._enqueuedAt

      const { pair, price, quantity, value, timestamp, type } = item

      const tradeData = {
        pair: pair.toUpperCase(),
        price, quantity, value, timestamp, type,
        time: new Date(timestamp).toLocaleTimeString()
      }

      recentTrades.push(tradeData)
      if (recentTrades.length > MAX_HISTORY) recentTrades.shift()

      const buf = buffers[pair] || (buffers[pair] = [])
      buf.push({ value, timestamp, price, quantity, type })
      const cutoff = Date.now() - WINDOW_MS
      while (buf.length && buf[0].timestamp < cutoff) buf.shift()

      io.emit('trade', tradeData)

      // --- z-score detection (per-symbol rolling stats, Welford's algorithm) ---
      updateStats(pair, value)
      const z = zScore(pair, value)
      const zResult = classifyByZScore(value, z)
      if (zResult) {
        const alert = {
          ...tradeData,
          whaleType: zResult.whaleType,
          zScore: zResult.zScore,
          detectionMethod: 'zscore',
          id: `${timestamp}-z-${Math.random()}`
        }
        io.emit('whale-alert', alert)
        whaleBatch.push(alert)
      }

      // --- composite signal (z-score + order book imbalance direction check) ---
      const imbalance = getImbalance(pair)
      const composite = classifyComposite(value, z, imbalance, type)
      if (composite) {
        const alert = {
          ...tradeData,
          whaleType: composite.whaleType,
          zScore: composite.zScore,
          imbalance: composite.imbalance,
          detectionMethod: 'composite',
          id: `${timestamp}-c-${Math.random()}`
        }
        io.emit('whale-alert', alert)
        whaleBatch.push(alert)
      }

      // --- static threshold (kept as reference / fallback) ---
      const staticType = classify(value)
      if (staticType) {
        const alert = {
          ...tradeData,
          whaleType: staticType,
          zScore: z,
          detectionMethod: 'static',
          id: `${timestamp}-s-${Math.random()}`
        }
        io.emit('whale-alert', alert)
        whaleBatch.push(alert)
      }

      // --- aggregated-window detection ---
      const totalValue = buf.reduce((s, x) => s + x.value, 0)
      const aggType = classify(totalValue)
      if (aggType && Date.now() - (lastEmit[pair] || 0) > MIN_EMIT_GAP_MS) {
        const alert = {
          id: `${Date.now()}-agg-${Math.random()}`,
          pair: pair.toUpperCase(),
          price, quantity: null,
          value: totalValue, totalValue,
          tradeCount: buf.length,
          timestamp: Date.now(),
          whaleType: aggType,
          type: 'AGGREGATED',
          detectionMethod: 'aggregated',
          time: new Date().toLocaleTimeString()
        }
        lastEmit[pair] = Date.now()
        io.emit('whale-alert', alert)
        whaleBatch.push(alert)
      }
    }

    queue.recordProcessed(items.length, Math.round(totalLag / items.length))

    if (whaleBatch.length) {
      try { await insertWhalesBatch(whaleBatch) }
      catch (err) { console.error('DB batch insert error', err) }
    }
  }, CONSUMER_INTERVAL_MS)
}

function connect(io, recentTrades, MAX_HISTORY, pairs = ['btcusdt']) {
  const list = Array.isArray(pairs) && pairs.length
    ? Array.from(new Set(pairs.map(_safePair)))
    : ['btcusdt']

  list.forEach(p => { buffers[p] = buffers[p] || []; lastEmit[p] = lastEmit[p] || 0 })
  startConsumer(io, recentTrades, MAX_HISTORY)

  // attempt lives in this closure so it persists across reconnects without
  // being a parameter (which would reset to 0 on every reconnect call).
  let attempt = 0

  function _connect() {
    const tradeStreams = list.map(p => `${p}@trade`)
    const depthStreams = list.map(p => `${p}@depth5`)
    const url = list.length > 1
      ? `wss://stream.binance.com:9443/stream?streams=${[...tradeStreams, ...depthStreams].join('/')}`
      : `wss://stream.binance.com:9443/ws/${list[0]}@trade`

    const ws = new WebSocket(url)

    ws.on('open', () => {
      console.log(`✅ Binance stream connected (${list.length} pairs, attempt ${attempt})`)
      attempt = 0   // reset so the next disconnect starts from a short delay
      _binanceConnected = true
      io.emit('connection-status', { connected: true })
      io.emit('pairs', list.map(p => p.toUpperCase()))
    })

    ws.on('message', (data) => {
      try {
        const msg        = JSON.parse(data)
        const streamName = msg.stream || null
        const payload    = msg.data || msg
        const [pair, streamType] = streamName
          ? streamName.split('@')
          : [list[0], 'trade']

        if (streamType === 'trade') {
          const price    = parseFloat(payload.p)
          const quantity = parseFloat(payload.q)
          queue.enqueue({
            pair, price, quantity,
            value: price * quantity,
            timestamp: payload.T,
            type: payload.m ? 'SELL' : 'BUY'
          })
        } else if (streamType === 'depth5') {
          updateDepth(pair, payload.bids, payload.asks)
        }
      } catch (err) {
        console.error('Stream parse error', err)
      }
    })

    ws.on('error', (err) => {
      console.error('❌ Binance WS error:', err && err.message)
      _binanceConnected = false
      io.emit('connection-status', { connected: false })
    })

    ws.on('close', () => {
      _binanceConnected = false
      io.emit('connection-status', { connected: false })
      const delay = _backoffMs(attempt)
      console.log(`🔌 Binance WS closed — reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1})`)
      attempt++
      setTimeout(_connect, delay)
    })
  }

  _connect()
}

module.exports = { connect, setWindowMs, getWindowMs, getQueueMetrics, getBinanceConnected }
