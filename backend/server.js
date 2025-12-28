const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

const { connect } = require('./services/binanceStream');
const { WHALE_THRESHOLDS } = require('./services/whaleDetector');

// default list of commonly traded USDT pairs (can be overridden by PAIRS env var)
const DEFAULT_PAIRS = [
  'btcusdt','ethusdt','bnbusdt','adausdt','xrpusdt','dogeusdt','solusdt','dotusdt','ltcusdt','bchusdt',
  'maticusdt','linkusdt','trxusdt','atomusdt','avaxusdt','ftmusdt','vetusdt','eosusdt','nearusdt','xlmusdt'
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', trades: recentTrades.length });
});

io.on('connection', (socket) => {
  console.log('👤 Client connected');
  socket.emit('history', recentTrades.slice(-3600));
  // send current thresholds to client
  socket.emit('thresholds', WHALE_THRESHOLDS);

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
