// Rolling per-symbol statistics using Welford's online algorithm.
//
// Welford's keeps a running mean and sum-of-squared-deviations (M2) that can
// be updated in O(1) without recomputing over the whole window.  The update
// rule is:
//   delta  = x - mean
//   mean  += delta / n
//   delta2 = x - mean          (recalculate AFTER updating mean)
//   M2    += delta * delta2
//   var    = M2 / (n - 1)      (sample variance, valid once n >= 2)
//
// This is numerically stable even for large float values, unlike the naive
// "Var = E[x²] - E[x]²" form which can catastrophically cancel.
//
// When the window is full we evict the oldest sample using the inverse of the
// same update rule (Chan's retraction formula), so std stays O(1) per trade.

const WINDOW_SIZE = Number(process.env.ROLLING_WINDOW_SIZE) || 500
const MIN_SAMPLES = Number(process.env.ROLLING_MIN_SAMPLES) || 30
const Z_CUTOFF   = Number(process.env.Z_SCORE_CUTOFF)      || 3.0

// Per-symbol state: { n, mean, M2, window: [] }
const state = {}

function _getState(pair) {
  if (!state[pair]) state[pair] = { n: 0, mean: 0, M2: 0, window: [] }
  return state[pair]
}

// Add one observation and return updated { mean, std, n }.
// Evicts oldest if at capacity.
function update(pair, x) {
  const s = _getState(pair)

  // Evict oldest if window is full
  if (s.window.length >= WINDOW_SIZE) {
    const old = s.window.shift()
    // Chan's retraction: reverse Welford for the removed value
    const newN    = s.n - 1
    const delta   = old - s.mean
    const newMean = (s.n * s.mean - old) / newN
    const delta2  = old - newMean
    s.M2  -= delta * delta2
    if (s.M2 < 0) s.M2 = 0  // float drift guard
    s.mean = newMean
    s.n    = newN
  }

  // Add new observation
  s.window.push(x)
  s.n++
  const delta  = x - s.mean
  s.mean      += delta / s.n
  const delta2 = x - s.mean
  s.M2        += delta * delta2

  const variance = s.n > 1 ? s.M2 / (s.n - 1) : 0
  return {
    mean: s.mean,
    std:  Math.sqrt(variance),
    n:    s.n
  }
}

// Compute z-score for a value given the current state for a pair (without
// modifying state — call update() first, then zScore()).
function zScore(pair, x) {
  const s = _getState(pair)
  if (s.n < MIN_SAMPLES) return null          // not enough data yet
  const variance = s.n > 1 ? s.M2 / (s.n - 1) : 0
  const std = Math.sqrt(variance)
  if (std === 0) return null                  // all values identical
  return (x - s.mean) / std
}

function getZCutoff()    { return Z_CUTOFF }
function getMinSamples() { return MIN_SAMPLES }
function getWindowSize() { return WINDOW_SIZE }

// Snapshot of per-symbol stats (useful for the /api/health endpoint)
function getAllStats() {
  return Object.fromEntries(
    Object.entries(state).map(([pair, s]) => {
      const variance = s.n > 1 ? s.M2 / (s.n - 1) : 0
      return [pair, { n: s.n, mean: +s.mean.toFixed(4), std: +Math.sqrt(variance).toFixed(4) }]
    })
  )
}

module.exports = { update, zScore, getZCutoff, getMinSamples, getWindowSize, getAllStats }
