const { WHALE_THRESHOLDS, classify, classifyByZScore, classifyComposite } = require('../services/whaleDetector')

const DOLPHIN_VAL   = WHALE_THRESHOLDS.DOLPHIN
const WHALE_VAL     = WHALE_THRESHOLDS.WHALE
const MEGA_VAL      = WHALE_THRESHOLDS.MEGALODON

// ─── classify (static thresholds) ────────────────────────────────────────────

describe('classify', () => {
  test('returns null below DOLPHIN threshold', () => {
    expect(classify(DOLPHIN_VAL - 1)).toBeNull()
  })

  test('returns DOLPHIN at DOLPHIN threshold', () => {
    expect(classify(DOLPHIN_VAL)).toBe('DOLPHIN')
  })

  test('returns DOLPHIN between DOLPHIN and WHALE', () => {
    expect(classify(WHALE_VAL - 1)).toBe('DOLPHIN')
  })

  test('returns WHALE at WHALE threshold', () => {
    expect(classify(WHALE_VAL)).toBe('WHALE')
  })

  test('returns WHALE between WHALE and MEGALODON', () => {
    expect(classify(MEGA_VAL - 1)).toBe('WHALE')
  })

  test('returns MEGALODON at MEGALODON threshold', () => {
    expect(classify(MEGA_VAL)).toBe('MEGALODON')
  })

  test('returns MEGALODON above MEGALODON threshold', () => {
    expect(classify(MEGA_VAL * 2)).toBe('MEGALODON')
  })
})

// ─── classifyByZScore ────────────────────────────────────────────────────────

describe('classifyByZScore', () => {
  // Default Z_SCORE_CUTOFF = 3.0
  const CUT = Number(process.env.Z_SCORE_CUTOFF) || 3.0

  test('returns null when z is null', () => {
    expect(classifyByZScore(MEGA_VAL, null)).toBeNull()
  })

  test('returns null when value is below dollar floor (DOLPHIN threshold)', () => {
    expect(classifyByZScore(DOLPHIN_VAL - 1, CUT + 1)).toBeNull()
  })

  test('returns null when z < cutoff', () => {
    expect(classifyByZScore(MEGA_VAL, CUT - 0.1)).toBeNull()
  })

  test('returns DOLPHIN when z >= cutoff', () => {
    const result = classifyByZScore(MEGA_VAL, CUT)
    expect(result).toMatchObject({ whaleType: 'DOLPHIN', zScore: CUT })
  })

  test('returns WHALE when z >= cutoff * 1.5', () => {
    const result = classifyByZScore(MEGA_VAL, CUT * 1.5)
    expect(result).toMatchObject({ whaleType: 'WHALE', zScore: CUT * 1.5 })
  })

  test('returns MEGALODON when z >= cutoff * 2.5', () => {
    const result = classifyByZScore(MEGA_VAL, CUT * 2.5)
    expect(result).toMatchObject({ whaleType: 'MEGALODON', zScore: CUT * 2.5 })
  })

  test('result contains zScore field equal to supplied z', () => {
    const z = CUT * 2
    const result = classifyByZScore(MEGA_VAL, z)
    expect(result.zScore).toBe(z)
  })
})

// ─── classifyComposite ───────────────────────────────────────────────────────
//
// classifyComposite ORs two independent signals — z-score and order book
// imbalance — rather than requiring both. Either one crossing its own
// threshold is enough to flag the trade, and the result lists which signal(s)
// fired so the alert payload can distinguish a pure book-pressure event from
// a statistical outlier from one that's both.

describe('classifyComposite', () => {
  const CUT   = Number(process.env.Z_SCORE_CUTOFF)       || 3.0
  const ITHRESH = Number(process.env.IMBALANCE_THRESHOLD) || 0.2

  test('returns null when both z and imbalance are null', () => {
    expect(classifyComposite(MEGA_VAL, null, null)).toBeNull()
  })

  test('returns null when value is below dollar floor, even with both signals firing', () => {
    expect(classifyComposite(DOLPHIN_VAL - 1, CUT + 1, ITHRESH + 0.1)).toBeNull()
  })

  test('returns null when neither signal crosses its threshold', () => {
    expect(classifyComposite(MEGA_VAL, CUT - 0.1, ITHRESH - 0.1)).toBeNull()
  })

  test('returns null when z is null and imbalance is below threshold', () => {
    expect(classifyComposite(MEGA_VAL, null, ITHRESH - 0.1)).toBeNull()
  })

  test('returns null when imbalance is null and z is below cutoff', () => {
    expect(classifyComposite(MEGA_VAL, CUT - 0.1, null)).toBeNull()
  })

  test('fires on z-score alone when imbalance is null', () => {
    const result = classifyComposite(MEGA_VAL, CUT + 1, null)
    expect(result).not.toBeNull()
    expect(result.signals).toEqual(['zscore'])
  })

  test('fires on positive imbalance alone when z is below cutoff', () => {
    const result = classifyComposite(MEGA_VAL, CUT - 0.1, ITHRESH + 0.1)
    expect(result).not.toBeNull()
    expect(result.signals).toEqual(['imbalance'])
  })

  test('fires on negative imbalance alone (ask-heavy book)', () => {
    const result = classifyComposite(MEGA_VAL, null, -(ITHRESH + 0.1))
    expect(result).not.toBeNull()
    expect(result.signals).toEqual(['imbalance'])
  })

  test('fires with both signals listed when both cross their thresholds', () => {
    const result = classifyComposite(MEGA_VAL, CUT + 1, ITHRESH + 0.1)
    expect(result).not.toBeNull()
    expect(result.signals).toEqual(['zscore', 'imbalance'])
  })

  test('result has whaleType, zScore, imbalance, and signals fields', () => {
    const result = classifyComposite(MEGA_VAL, CUT, ITHRESH + 0.1)
    expect(result).toHaveProperty('whaleType')
    expect(result).toHaveProperty('zScore')
    expect(result).toHaveProperty('imbalance')
    expect(result).toHaveProperty('signals')
  })

  test('returns MEGALODON tier when z >= cutoff * 2.5', () => {
    const result = classifyComposite(MEGA_VAL, CUT * 2.5, null)
    expect(result.whaleType).toBe('MEGALODON')
  })

  test('returns WHALE tier when z >= cutoff * 1.5', () => {
    const result = classifyComposite(MEGA_VAL, CUT * 1.5, null)
    expect(result.whaleType).toBe('WHALE')
  })

  test('returns DOLPHIN tier when z just at cutoff', () => {
    const result = classifyComposite(MEGA_VAL, CUT, null)
    expect(result.whaleType).toBe('DOLPHIN')
  })

  test('falls back to static dollar tier when only imbalance fires', () => {
    const result = classifyComposite(MEGA_VAL, null, ITHRESH + 0.1)
    expect(result.whaleType).toBe('MEGALODON')   // MEGA_VAL is above the MEGALODON $ tier
  })

  test('imbalance field in result matches supplied imbalance', () => {
    const imb = ITHRESH + 0.15
    const result = classifyComposite(MEGA_VAL, CUT, imb)
    expect(result.imbalance).toBe(imb)
  })

  test('zScore field in result matches supplied z (including null)', () => {
    const result = classifyComposite(MEGA_VAL, null, ITHRESH + 0.1)
    expect(result.zScore).toBeNull()
  })
})
