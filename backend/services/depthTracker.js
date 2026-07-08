// Per-symbol order book imbalance tracker.
//
// Subscribes (externally) to Binance @depth5 snapshots and maintains the most
// recent top-N bid/ask state per symbol.  The imbalance ratio is:
//
//   imbalance = (bidVol - askVol) / (bidVol + askVol)
//
// Result is in [-1, 1]:
//   +1  → pure bid pressure (strong buying interest)
//    0  → balanced book
//   -1  → pure ask pressure (strong selling interest)
//
// We use @depth5 (top-5 levels only) because:
//   - lower bandwidth than full-depth stream
//   - levels beyond 5 are rarely walked in a single whale trade anyway
//   - the snapshot format is simpler than the incremental diff format
//
// IMBALANCE_LEVELS is configurable; set DEPTH_LEVELS env var to override.
// IMBALANCE_THRESHOLD is the minimum |imbalance| required for the composite
// signal — below this the book is considered "neutral".

const DEPTH_LEVELS          = Number(process.env.DEPTH_LEVELS)         || 5
const IMBALANCE_THRESHOLD   = Number(process.env.IMBALANCE_THRESHOLD)  || 0.2

// per-symbol: { imbalance, bidVol, askVol, lastUpdate }
const bookState = {}

// Called from the WS message handler every time a @depth5 snapshot arrives.
// bids/asks are arrays of [priceStr, qtyStr] from Binance.
function updateDepth(pair, bids, asks) {
  const topBids = (bids || []).slice(0, DEPTH_LEVELS)
  const topAsks = (asks || []).slice(0, DEPTH_LEVELS)
  const bidVol = topBids.reduce((s, [, q]) => s + parseFloat(q), 0)
  const askVol = topAsks.reduce((s, [, q]) => s + parseFloat(q), 0)
  const total  = bidVol + askVol
  const imbalance = total > 0 ? (bidVol - askVol) / total : 0

  bookState[pair] = { imbalance, bidVol, askVol, lastUpdate: Date.now() }
}

// Returns the current imbalance ratio for a pair, or null if we have no data
// yet (depth snapshot hasn't arrived) or the snapshot is stale (> 10s old).
function getImbalance(pair) {
  const s = bookState[pair]
  if (!s) return null
  if (Date.now() - s.lastUpdate > 10_000) return null   // stale — don't use it
  return s.imbalance
}

function getImbalanceThreshold() { return IMBALANCE_THRESHOLD }
function getDepthLevels()        { return DEPTH_LEVELS }

// Snapshot for /api/health
function getAllDepth() {
  return Object.fromEntries(
    Object.entries(bookState).map(([pair, s]) => [
      pair,
      {
        imbalance:  +s.imbalance.toFixed(4),
        bidVol:     +s.bidVol.toFixed(4),
        askVol:     +s.askVol.toFixed(4),
        ageMs:      Date.now() - s.lastUpdate
      }
    ])
  )
}

module.exports = { updateDepth, getImbalance, getImbalanceThreshold, getDepthLevels, getAllDepth }
