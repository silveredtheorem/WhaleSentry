# Whale Sentry — Architecture

Real-time crypto whale trade detection across 32 Binance pairs, with
statistical anomaly detection and order book signal confirmation.

---

## System overview

```
Binance WS ──► Ring buffer ──► Consumer loop ──► Socket.IO ──► React UI
(trade+depth)   (5 000 cap)     (50 ms tick)      (broadcast)
                                     │
                              ┌──────┴──────┐
                          z-score       composite
                         detector       detector
                        (Phase 1)      (Phase 2)
                              └──────┬──────┘
                                 SQLite DB
                               (batch insert)
```

---

## Ingestion — decoupled ring buffer

**Problem:** WebSocket `message` events arrive on the event loop at up to
~2 000/s across 32 pairs. Doing classification, DB writes, and Socket.IO
broadcasts synchronously in the message handler would stall the socket read
and cause Binance to close the connection.

**Solution:** The message handler does one thing — parse the raw JSON and call
`queue.enqueue()`. A separate `setInterval` consumer (50 ms tick) drains the
queue and does all downstream work.

**Backpressure:** The queue is a fixed-capacity ring buffer (default 5 000
slots). When full, the oldest item is dropped rather than blocking. This
bounds memory and latency under burst load. The drop count is exposed at
`/api/health` so you can observe whether the consumer is keeping up.

**File:** `backend/services/tradeQueue.js`

---

## WebSocket strategy — single combined stream

Binance supports a multiplexed combined stream endpoint:
```
wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/.../btcusdt@depth5/...
```

One WebSocket connection carries trade events **and** order book snapshots for
all 32 pairs, rather than 32+ individual connections. This stays well within
Binance's connection limits and simplifies reconnection logic.

**Reconnection:** Exponential backoff with full jitter —
`delay = random(0, min(30s, 1s × 2^attempt))`. Full jitter (vs decorrelated
jitter) is used because all clients reconnect independently; spreading their
delays prevents a thundering herd on the Binance endpoint after an outage.
The attempt counter resets to 0 on a successful `open` event.

**File:** `backend/services/binanceStream.js`

---

## Detection — three independent signals

All three run on every trade and emit independently tagged alerts, so you can
compare their agreement rate at query time.

### 1. Static threshold (`detectionMethod: 'static'`)

The baseline: flag any trade whose USD notional value exceeds a fixed tier.

| Tier       | Threshold |
|------------|-----------|
| DOLPHIN    | $200 000  |
| WHALE      | $500 000  |
| MEGALODON  | $1 000 000 |

Thresholds are mutable at runtime via `socket.emit('set-thresholds', {...})`
and are broadcast to all connected clients on change.

**Weakness:** ignores context. A $300 000 trade on BTCUSDT during a busy
session is routine; the same size on LINKETH at 3 AM is extraordinary. Static
thresholds cannot express that.

### 2. Rolling z-score (`detectionMethod: 'zscore'`)

For each symbol, maintain a rolling mean and variance using **Welford's online
algorithm**. This updates in O(1) per trade with no recomputation over the
window:

```
δ  = x − mean
mean += δ / n
δ₂ = x − mean          ← recalculated after mean update
M₂ += δ × δ₂
var = M₂ / (n − 1)     ← sample variance
```

When the window is full (default 500 trades), the oldest value is evicted
using **Chan's retraction formula** — the algebraic inverse of the add step —
so memory is bounded at exactly `windowSize` floats per symbol regardless of
uptime.

```
newMean = (n × mean − old) / (n − 1)
M₂     -= (old − mean) × (old − newMean)
```

A trade is flagged when `z = (value − mean) / std` exceeds a configurable
cutoff (default 3σ) **and** the notional value is above the static DOLPHIN
floor. The floor prevents tiny-but-unusual trades on illiquid pairs from
triggering alerts during warmup.

The z-score classifier returns `null` until 30 samples have been seen (the
`MIN_SAMPLES` guard), since std is meaningless with 2–3 data points.

**Why Welford's over a ring buffer + recompute?** A naïve implementation would
store the last N values and recompute mean/variance on each tick — O(N) per
trade. Welford's is O(1). At 2 000 trades/s × 32 pairs with N=500, that's the
difference between ~32 million float operations per second and ~64 per second.

**File:** `backend/services/rollingStats.js`

### 3. Composite signal (`detectionMethod: 'composite'`)

Combines the z-score with real-time order book pressure from the `@depth5`
stream (top 5 bid/ask levels, updated ~100 ms):

```
imbalance = (bidVol − askVol) / (bidVol + askVol)   ∈ [−1, 1]
```

A trade is a composite alert only when **all three** hold simultaneously:
1. z-score ≥ cutoff (statistically large for this symbol)
2. |imbalance| ≥ threshold (default 0.2 — book is not balanced)
3. Direction aligns: BUY into positive imbalance, SELL into negative

The direction check is the key addition. A large buy trade when the book is
ask-heavy is more likely arbitrage or hedging — the book was *not* set up for
it. A large buy when the book is already bid-heavy suggests informed
accumulation: someone is buying into existing buy pressure.

The depth state is considered stale after 10 seconds and returns `null` (no
composite alert) rather than using outdated book data.

**File:** `backend/services/depthTracker.js`

### Aggregated-window detection

In addition to per-trade signals, trades within a rolling time window (default
5 s, configurable) are summed per symbol. If the combined value crosses a
threshold, an `AGGREGATED` alert fires — this catches slow accumulation spread
across many small trades that individually wouldn't trigger.

---

## Data layer

SQLite with a single `whales` table. Each consumer tick collects all alerts
into a batch and issues one `INSERT OR REPLACE INTO whales VALUES (?,...),...`
statement — a true multi-row insert, not a transaction-wrapped loop. Fewer
round-trips to the WAL, lower contention.

The DB is optional (`ENABLE_DB=true` env var). When disabled, the server runs
entirely in-memory — useful for development and testing.

**Historical query:** `GET /api/whales` supports filtering by pair, time range,
detection method, and whale tier. See `server.js` for parameter documentation.

**File:** `backend/services/db.js`

---

## Frontend

React 18 + Vite + Tailwind CSS. Socket.IO client receives `trade` and
`whale-alert` events and updates state.

Key design points:
- **Pair selector** is derived from the live `pairs` socket event (replayed to
  every new client on connection), not a hardcoded list. Coin B options are
  constrained to tokens that form a real streamed pair with the selected Coin A,
  preventing silent empty-state from impossible combinations.
- **Dark mode** toggles `class="dark"` on `<html>` via React state — no page
  reload, no flash. Chart.js canvas colors are switched via props since Tailwind
  `dark:` variants can't reach `<canvas>` elements.
- **Chart label** tracks the selected pair (`${coinA}/${coinB}`) rather than
  hardcoding "BTC Price".

---

## Configuration

All tunables via environment variables — no code changes needed:

| Variable                    | Default | Description                          |
|-----------------------------|---------|--------------------------------------|
| `AGG_WINDOW_MS`             | 5000    | Aggregated-window size (ms)          |
| `MIN_EMIT_GAP_MS`           | 5000    | Min gap between aggregated alerts    |
| `TRADE_CONSUMER_INTERVAL_MS`| 50      | Consumer drain interval (ms)         |
| `TRADE_QUEUE_CAPACITY`      | 5000    | Ring buffer size (trades)            |
| `ROLLING_WINDOW_SIZE`       | 500     | Welford's sliding window (trades)    |
| `ROLLING_MIN_SAMPLES`       | 30      | Min samples before z-score fires     |
| `Z_SCORE_CUTOFF`            | 3.0     | σ threshold for z-score alerts       |
| `DEPTH_LEVELS`              | 5       | Order book levels for imbalance calc |
| `IMBALANCE_THRESHOLD`       | 0.2     | Min |imbalance| for composite signal |
| `ENABLE_DB`                 | false   | Enable SQLite persistence            |
| `DB_PATH`                   | ./whales.db | SQLite file path                |
| `PAIRS`                     | (32 defaults) | Comma-separated pair list   |

---

## Running

```bash
# Backend
cd backend
npm install
ENABLE_DB=true npm start          # with persistence
npm run dev                       # nodemon watch mode

# Tests
npm test                          # Jest with coverage

# Frontend
cd frontend
npm install
npm run dev                       # Vite dev server → http://localhost:5173
```
