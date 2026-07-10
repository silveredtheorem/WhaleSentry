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

// Returns { whaleType, zScore, imbalance, signals } or null.
// Fires when EITHER signal crosses its own threshold — z-score vs. this
// symbol's rolling distribution, or order book imbalance vs. IMBALANCE_THRESHOLD.
// `signals` lists which of ['zscore', 'imbalance'] actually fired, so callers
// (and the emitted alert payload) can tell whales apart from book-pressure-only
// events without re-deriving the thresholds.
function classifyComposite(value, z, imbalance) {
  if (value < WHALE_THRESHOLDS.DOLPHIN) return null

  const cutoff      = getZCutoff()
  const imbalThresh = getImbalanceThreshold()

  const zFired      = z !== null && z >= cutoff
  const imbalFired  = imbalance !== null && Math.abs(imbalance) >= imbalThresh

  if (!zFired && !imbalFired) return null

  const signals = []
  if (zFired)     signals.push('zscore')
  if (imbalFired) signals.push('imbalance')

  // Tier by z-score severity when it fired; fall back to the static dollar
  // tier when the trade only tripped the imbalance signal.
  let whaleType
  if (zFired) {
    if      (z >= cutoff * 2.5) whaleType = 'MEGALODON'
    else if (z >= cutoff * 1.5) whaleType = 'WHALE'
    else                        whaleType = 'DOLPHIN'
  } else {
    whaleType = classify(value) || 'DOLPHIN'
  }

  return { whaleType, zScore: z, imbalance, signals }
}

module.exports = { WHALE_THRESHOLDS, classify, classifyByZScore, classifyComposite }
