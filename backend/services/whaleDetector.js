const { getZCutoff } = require('./rollingStats')
const { getImbalanceThreshold } = require('./depthTracker')

const WHALE_THRESHOLDS = {
  DOLPHIN:   Number(process.env.THRESHOLD_DOLPHIN)   || 200_000,
  WHALE:     Number(process.env.THRESHOLD_WHALE)      || 500_000,
  MEGALODON: Number(process.env.THRESHOLD_MEGALODON)  || 1_000_000,
}

function classify(value) {
  if (value >= WHALE_THRESHOLDS.MEGALODON) return 'MEGALODON'
  if (value >= WHALE_THRESHOLDS.WHALE)     return 'WHALE'
  if (value >= WHALE_THRESHOLDS.DOLPHIN)   return 'DOLPHIN'
  return null
}

// Returns { whaleType, zScore } or null.
// The static dollar floor prevents illiquid-pair microstructure noise from
// triggering alerts — a $50 trade that's 4σ is not a whale.
function classifyByZScore(value, z) {
  if (z === null) return null
  if (value < WHALE_THRESHOLDS.DOLPHIN) return null

  const cutoff = getZCutoff()
  if (z >= cutoff * 2.5) return { whaleType: 'MEGALODON', zScore: z }
  if (z >= cutoff * 1.5) return { whaleType: 'WHALE',     zScore: z }
  if (z >= cutoff)       return { whaleType: 'DOLPHIN',   zScore: z }
  return null
}

// Returns { whaleType, zScore, imbalance } or null.
// Requires elevated z-score AND book imbalanced in the same direction as the trade.
// A BUY into ask-heavy book is likely arbitrage; a BUY into bid-heavy book suggests
// informed accumulation — that's the distinction this filter captures.
function classifyComposite(value, z, imbalance, tradeType) {
  if (z === null || imbalance === null) return null
  if (value < WHALE_THRESHOLDS.DOLPHIN) return null

  const cutoff      = getZCutoff()
  const imbalThresh = getImbalanceThreshold()

  if (z < cutoff) return null

  const isBuy = String(tradeType).toUpperCase() === 'BUY'
  const directionAligned =
    (isBuy  && imbalance >=  imbalThresh) ||
    (!isBuy && imbalance <= -imbalThresh)

  if (!directionAligned) return null

  let whaleType
  if      (z >= cutoff * 2.5) whaleType = 'MEGALODON'
  else if (z >= cutoff * 1.5) whaleType = 'WHALE'
  else                        whaleType = 'DOLPHIN'

  return { whaleType, zScore: z, imbalance }
}

module.exports = { WHALE_THRESHOLDS, classify, classifyByZScore, classifyComposite }
