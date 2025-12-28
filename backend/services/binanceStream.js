const WebSocket = require('ws');
const { classify, WHALE_THRESHOLDS } = require('./whaleDetector');
const { insertWhale } = require('./db');

// Configurable sliding window for aggregated detection (ms)
const WINDOW_MS = Number(process.env.AGG_WINDOW_MS) || 5000
const MIN_EMIT_GAP_MS = Number(process.env.MIN_EMIT_GAP_MS) || 5000

// maintain ws per pair and recent buffers per pair
const sockets = {}
const buffers = {} // pair -> [{ value, timestamp, price, quantity, type }]
const lastEmit = {} // pair -> timestamp

function pairStreamUrl(pair) {
  // pair should be lowercase like btcusdt
  return `wss://stream.binance.com:9443/ws/${pair}@trade`
}

function _safePairName(p) {
  return String(p || '').toLowerCase()
}

function connect(io, recentTrades, MAX_HISTORY, pairs = ['btcusdt']) {
  const list = Array.isArray(pairs) && pairs.length ? Array.from(new Set(pairs.map(p => _safePairName(p)))) : ['btcusdt']

  // initialize buffers & lastEmit for all pairs
  list.forEach(p => { buffers[p] = buffers[p] || []; lastEmit[p] = lastEmit[p] || 0 })

  // if many pairs, prefer combined stream to reduce connections
  const useCombined = list.length > 1
  if (useCombined) {
    const streams = list.map(p => `${p}@trade`).join('/')
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`
    const ws = new WebSocket(url)
    sockets.combined = ws

    ws.on('open', () => {
      console.log(`✅ Connected to Binance combined stream for ${list.length} pairs`)
      io.emit('connection-status', { connected: true })
      io.emit('pairs', list.map(p => p.toUpperCase()))
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data)
        // combined stream structure: { stream: 'btcusdt@trade', data: { ... } }
        const trade = msg.data || msg
        const streamName = msg.stream || null
        const pair = streamName ? streamName.split('@')[0] : null
        if (!trade || !pair) return

        const price = parseFloat(trade.p)
        const quantity = parseFloat(trade.q)
        const value = price * quantity
        const timestamp = trade.T
        const isBuy = !trade.m

        const tradeData = {
          pair: pair.toUpperCase(),
          price,
          quantity,
          value,
          timestamp,
          type: isBuy ? 'BUY' : 'SELL',
          time: new Date(timestamp).toLocaleTimeString()
        }

        recentTrades.push(tradeData)
        if (recentTrades.length > MAX_HISTORY) recentTrades.shift()

        const buf = buffers[pair] || (buffers[pair] = [])
        buf.push({ value, timestamp, price, quantity, type: tradeData.type })
        const cutoff = Date.now() - WINDOW_MS
        while (buf.length && buf[0].timestamp < cutoff) buf.shift()

        io.emit('trade', tradeData)

        const indivType = classify(value)
        if (indivType) {
          const whaleAlert = { ...tradeData, whaleType: indivType, id: `${timestamp}-${Math.random()}` }
          io.emit('whale-alert', whaleAlert)
          insertWhale({ ...whaleAlert }).catch(err => console.error('DB insert error', err))
        }

        const totalValue = buf.reduce((s, x) => s + (x.value || 0), 0)
        const tradeCount = buf.length
        const aggType = classify(totalValue)
        if (aggType && (Date.now() - (lastEmit[pair] || 0) > MIN_EMIT_GAP_MS)) {
          const aggAlert = {
            id: `${Date.now()}-agg-${Math.random()}`,
            pair: pair.toUpperCase(),
            price: price,
            quantity: null,
            value: totalValue,
            totalValue,
            tradeCount,
            timestamp: Date.now(),
            whaleType: aggType,
            type: 'AGGREGATED',
            time: new Date().toLocaleTimeString()
          }
          lastEmit[pair] = Date.now()
          io.emit('whale-alert', aggAlert)
          insertWhale({ ...aggAlert }).catch(err => console.error('DB insert error', err))
        }

      } catch (err) {
        console.error('Error parsing Binance combined message', err)
      }
    })

    ws.on('error', (err) => {
      console.error('❌ Binance combined WebSocket error:', err && err.message ? err.message : err)
      io.emit('connection-status', { connected: false, error: err && err.message })
    })

    ws.on('close', () => {
      console.log('🔌 Binance combined WebSocket closed — reconnecting in 5s')
      io.emit('connection-status', { connected: false })
      setTimeout(() => connect(io, recentTrades, MAX_HISTORY, list), 5000)
    })

    return
  }

  // fallback: single pair
  const pair = list[0]
  const ws = new WebSocket(pairStreamUrl(pair))
  sockets[pair] = ws

  ws.on('open', () => {
    console.log(`✅ Connected to Binance stream for ${pair}`)
    io.emit('connection-status', { connected: true })
    io.emit('pairs', list.map(p => p.toUpperCase()))
  })

  ws.on('message', (data) => {
    try {
      const trade = JSON.parse(data)
      const price = parseFloat(trade.p)
      const quantity = parseFloat(trade.q)
      const value = price * quantity
      const timestamp = trade.T
      const isBuy = !trade.m

      const tradeData = {
        pair: pair.toUpperCase(),
        price,
        quantity,
        value,
        timestamp,
        type: isBuy ? 'BUY' : 'SELL',
        time: new Date(timestamp).toLocaleTimeString()
      }

      recentTrades.push(tradeData)
      if (recentTrades.length > MAX_HISTORY) recentTrades.shift()

      const buf = buffers[pair]
      buf.push({ value, timestamp, price, quantity, type: tradeData.type })
      const cutoff = Date.now() - WINDOW_MS
      while (buf.length && buf[0].timestamp < cutoff) buf.shift()

      io.emit('trade', tradeData)

      const indivType = classify(value)
      if (indivType) {
        const whaleAlert = { ...tradeData, whaleType: indivType, id: `${timestamp}-${Math.random()}` }
        io.emit('whale-alert', whaleAlert)
        insertWhale({ ...whaleAlert }).catch(err => console.error('DB insert error', err))
      }

      const totalValue = buf.reduce((s, x) => s + (x.value || 0), 0)
      const tradeCount = buf.length
      const aggType = classify(totalValue)
      if (aggType && (Date.now() - (lastEmit[pair] || 0) > MIN_EMIT_GAP_MS)) {
        const aggAlert = {
          id: `${Date.now()}-agg-${Math.random()}`,
          pair: pair.toUpperCase(),
          price: price,
          quantity: null,
          value: totalValue,
          totalValue,
          tradeCount,
          timestamp: Date.now(),
          whaleType: aggType,
          type: 'AGGREGATED',
          time: new Date().toLocaleTimeString()
        }
        lastEmit[pair] = Date.now()
        io.emit('whale-alert', aggAlert)
        insertWhale({ ...aggAlert }).catch(err => console.error('DB insert error', err))
      }

    } catch (err) {
      console.error('Error parsing Binance message', err)
    }
  })

  ws.on('error', (err) => {
    console.error('❌ Binance WebSocket error:', err && err.message ? err.message : err)
    io.emit('connection-status', { connected: false, error: err && err.message })
  })

  ws.on('close', () => {
    console.log('🔌 Binance WebSocket closed — reconnecting in 5s')
    io.emit('connection-status', { connected: false })
    setTimeout(() => connect(io, recentTrades, MAX_HISTORY, [pair]), 5000)
  })
}

module.exports = { connect }
