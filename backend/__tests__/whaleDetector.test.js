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

describe('classifyComposite', () => {
  const CUT   = Number(process.env.Z_SCORE_CUTOFF)       || 3.0
  const ITHRESH = Number(process.env.IMBALANCE_THRESHOLD) || 0.2

  test('returns null when z is null', () => {
    expect(classifyComposite(MEGA_VAL, null, ITHRESH + 0.1, 'BUY')).toBeNull()
  })

  test('returns null when imbalance is null', () => {
    expect(classifyComposite(MEGA_VAL, CUT + 1, null, 'BUY')).toBeNull()
  })

  test('returns null when value is below dollar floor', () => {
    expect(classifyComposite(DOLPHIN_VAL - 1, CUT + 1, ITHRESH + 0.1, 'BUY')).toBeNull()
  })

  test('returns null when z < cutoff even if imbalance aligned', () => {
    expect(classifyComposite(MEGA_VAL, CUT - 0.1, ITHRESH + 0.1, 'BUY')).toBeNull()
  })

  test('returns null when BUY but book is ask-heavy (imbalance negative)', () => {
    expect(classifyComposite(MEGA_VAL, CUT + 1, -(ITHRESH + 0.1), 'BUY')).toBeNull()
  })

  test('returns null when SELL but book is bid-heavy (imbalance positive)', () => {
    expect(classifyComposite(MEGA_VAL, CUT + 1, ITHRESH + 0.1, 'SELL')).toBeNull()
  })

  test('returns null when BUY but imbalance below threshold', () => {
    expect(classifyComposite(MEGA_VAL, CUT + 1, ITHRESH - 0.01, 'BUY')).toBeNull()
  })

  test('returns alert when BUY and book is bid-heavy', () => {
    const result = classifyComposite(MEGA_VAL, CUT, ITHRESH + 0.1, 'BUY')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('whaleType')
    expect(result).toHaveProperty('zScore')
    expect(result).toHaveProperty('imbalance')
  })

  test('returns alert when SELL and book is ask-heavy', () => {
    const result = classifyComposite(MEGA_VAL, CUT, -(ITHRESH + 0.1), 'SELL')
    expect(result).not.toBeNull()
    expect(result.whaleType).toBeDefined()
  })

  test('tradeType is case-insensitive', () => {
    const result = classifyComposite(MEGA_VAL, CUT, ITHRESH + 0.1, 'buy')
    expect(result).not.toBeNull()
  })

  test('returns MEGALODON tier when z >= cutoff * 2.5', () => {
    const result = classifyComposite(MEGA_VAL, CUT * 2.5, ITHRESH + 0.1, 'BUY')
    expect(result.whaleType).toBe('MEGALODON')
  })

  test('returns WHALE tier when z >= cutoff * 1.5', () => {
    const result = classifyComposite(MEGA_VAL, CUT * 1.5, ITHRESH + 0.1, 'BUY')
    expect(result.whaleType).toBe('WHALE')
  })

  test('returns DOLPHIN tier when z just at cutoff', () => {
    const result = classifyComposite(MEGA_VAL, CUT, ITHRESH + 0.1, 'BUY')
    expect(result.whaleType).toBe('DOLPHIN')
  })

  test('imbalance field in result matches supplied imbalance', () => {
    const imb = ITHRESH + 0.15
    const result = classifyComposite(MEGA_VAL, CUT, imb, 'BUY')
    expect(result.imbalance).toBe(imb)
  })
})
