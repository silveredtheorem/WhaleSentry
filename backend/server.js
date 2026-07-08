const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

const { connect, setWindowMs, getWindowMs, getQueueMetrics, getBinanceConnected } = require('./services/binanceStream');
const { getAllStats, getZCutoff, getWindowSize, getMinSamples } = require('./services/rollingStats');
const { getAllDepth, getDepthLevels } = require('./services/depthTracker');
const { WHALE_THRESHOLDS } = require('./services/whaleDetector');

// default list of commonly traded pairs (can be overridden by PAIRS env var)
const DEFAULT_PAIRS = [
  // USDT pairs
  'btcusdt','ethusdt','bnbusdt','adausdt','xrpusdt','dogeusdt','solusdt','dotusdt','ltcusdt','bchusdt',
  'maticusdt','linkusdt','trxusdt','atomusdt','avaxusdt','ftmusdt','vetusdt','eosusdt','nearusdt','xlmusdt',
  // BTC pairs
  'ethbtc','bnbbtc','xrpbtc','ltcbtc','bchbtc','dotbtc','linkbtc',
  // ETH pairs
  'bnbeth','xrpeth','ltceth','linketh','adaeth'
]

const PAIRS = (process.env.PAIRS && process.env.PAIRS.trim().length > 0)
  ? process.env.PAIRS.split(',').map(p => p.trim()).filter(Boolean)
  : DEFAULT_PAIRS

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

const recentTrades = [];
const MAX_HISTORY = 3600; // keep up to 1 hour of per-second data if needed

connect(io, recentTrades, MAX_HISTORY, PAIRS);

app.get('/api/recent-trades', (req, res) => {
  res.json(recentTrades.slice(-3600));
});

app.get('/api/thresholds', (req, res) => {
  res.json(WHALE_THRESHOLDS);
});

app.get('/api/detection-window', (req, res) => {
  res.json({ windowMs: getWindowMs() });
});

app.post('/api/detection-window', (req, res) => {
  const { windowMs } = req.body || {};
  if (windowMs == null) return res.status(400).json({ error: 'windowMs required' });
  const newWindow = setWindowMs(windowMs);
  io.emit('detection-window-updated', { windowMs: newWindow });
  res.json({ windowMs: newWindow });
});

// test endpoint to emit a whale alert (useful for debugging)
app.post('/api/test-whale', (req, res) => {
  const { price = 50000, quantity = 1, type = 'SELL' } = req.body || {}
  const value = Number(price) * Number(quantity)
  const timestamp = Date.now()
  const whaleType = (value >= WHALE_THRESHOLDS.MEGALODON) ? 'MEGALODON' : (value >= WHALE_THRESHOLDS.WHALE) ? 'WHALE' : 'DOLPHIN'
  const whaleAlert = {
    price: Number(price),
    quantity: Number(quantity),
    value,
    timestamp,
    type,
    whaleType,
    time: new Date(timestamp).toLocaleTimeString(),
    id: `${timestamp}-test`
  }
  io.emit('whale-alert', whaleAlert)
  console.log('🔔 Emitted test whale alert', whaleAlert)
  res.json({ ok: true, whaleAlert })
})

// Historical whale query — supports filtering by pair, time range, detection method,
// and whale tier.  All parameters are optional; defaults to last 100 events.
//
// GET /api/whales?pair=BTCUSDT&from=1700000000000&to=1700003600000
//                &method=zscore&tier=WHALE&limit=50
app.get('/api/whales', (req, res) => {
  const { getDb } = require('./services/db')
  const db = getDb()
  if (!db) return res.status(503).json({ error: 'DB not enabled (set ENABLE_DB=true)' })

  const { pair, from, to, method, tier, limit = 100 } = req.query

  const conditions = []
  const params     = []

  if (pair)   { conditions.push('pair = ?');            params.push(pair.toUpperCase()) }
  if (from)   { conditions.push('timestamp >= ?');      params.push(Number(from)) }
  if (to)     { conditions.push('timestamp <= ?');      params.push(Number(to)) }
  if (method) { conditions.push('detectionMethod = ?'); params.push(method) }
  if (tier)   { conditions.push('whaleType = ?');       params.push(tier.toUpperCase()) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const sql   = `SELECT * FROM whales ${where} ORDER BY timestamp DESC LIMIT ?`
  params.push(Math.min(Number(limit) || 100, 1000))

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ count: rows.length, whales: rows })
  })
})

app.get('/api/health', (req, res) => {
  const queue = getQueueMetrics();
  res.json({
    status: 'ok',
    trades: recentTrades.length,
    queue: {
      depth: queue.depth,
      capacity: queue.capacity,
      droppedCount: queue.droppedCount,
      processedCount: queue.processedCount,
      processingLagMs: queue.lastLagMs
    },
    rollingStats: {
      windowSize: getWindowSize(),
      minSamples: getMinSamples(),
      zCutoff: getZCutoff(),
      perSymbol: getAllStats()
    },
    orderBook: {
      depthLevels: getDepthLevels(),
      perSymbol: getAllDepth()
    }
  });
});

io.on('connection', (socket) => {
  console.log('👤 Client connected');
  socket.emit('history', recentTrades.slice(-3600));
  socket.emit('pairs', PAIRS.map(p => p.toUpperCase()));
  socket.emit('connection-status', { connected: getBinanceConnected() });
  socket.emit('thresholds', WHALE_THRESHOLDS);
  socket.emit('detection-window', { windowMs: getWindowMs() });

  // allow clients to update thresholds (will broadcast to all clients)
  socket.on('set-thresholds', (newThresh) => {
    try {
      if (!newThresh || typeof newThresh !== 'object') return;
      if (newThresh.DOLPHIN != null) WHALE_THRESHOLDS.DOLPHIN = Number(newThresh.DOLPHIN);
      if (newThresh.WHALE != null) WHALE_THRESHOLDS.WHALE = Number(newThresh.WHALE);
      if (newThresh.MEGALODON != null) WHALE_THRESHOLDS.MEGALODON = Number(newThresh.MEGALODON);
      io.emit('thresholds-updated', WHALE_THRESHOLDS);
      console.log('🔧 Thresholds updated', WHALE_THRESHOLDS);
    } catch (err) {
      console.error('Error updating thresholds', err);
    }
  });

  // allow clients to update detection window
  socket.on('set-detection-window', (payload) => {
    try {
      if (!payload || payload.windowMs == null) return;
      const newWindow = setWindowMs(payload.windowMs);
      io.emit('detection-window-updated', { windowMs: newWindow });
      console.log('🔧 Detection window updated', newWindow);
    } catch (err) {
      console.error('Error updating detection window', err);
    }
  });

  socket.on('ping', (cb) => cb && cb('pong'));

  socket.on('disconnect', () => {
    console.log('👋 Client disconnected');
  });

  // allow socket clients to emit a test whale alert
  socket.on('test-whale', (payload) => {
    try {
      const price = Number(payload && payload.price) || WHALE_THRESHOLDS.WHALE || 10000
      const quantity = Number(payload && payload.quantity) || 1
      const type = payload && payload.type ? payload.type : 'BUY'
      const value = price * quantity
      const timestamp = Date.now()
      const whaleType = (value >= WHALE_THRESHOLDS.MEGALODON) ? 'MEGALODON' : (value >= WHALE_THRESHOLDS.WHALE) ? 'WHALE' : 'DOLPHIN'
      const whaleAlert = {
        price,
        quantity,
        value,
        timestamp,
        type,
        whaleType,
        time: new Date(timestamp).toLocaleTimeString(),
        id: `${timestamp}-socket-test`
      }
      io.emit('whale-alert', whaleAlert)
      console.log('🔔 Emitted socket test whale alert', whaleAlert)
    } catch (err) {
      console.error('Error handling socket test-whale', err)
    }
  })
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
