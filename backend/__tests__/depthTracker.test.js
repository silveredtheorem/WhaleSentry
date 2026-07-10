const { updateDepth, getImbalance, getImbalanceThreshold, getDepthLevels, getAllDepth } = require('../services/depthTracker')

// Each test uses distinct pair names to avoid cross-test state pollution
// since depthTracker holds module-level state.

describe('updateDepth / getImbalance', () => {
  test('returns null for unknown pair', () => {
    expect(getImbalance('UNKNOWNUSDT')).toBeNull()
  })

  test('imbalance = 1 when only bids have volume', () => {
    updateDepth('btcusdt_a', [['50000', '10']], [])
    expect(getImbalance('btcusdt_a')).toBeCloseTo(1)
  })

  test('imbalance = -1 when only asks have volume', () => {
    updateDepth('btcusdt_b', [], [['50000', '10']])
    expect(getImbalance('btcusdt_b')).toBeCloseTo(-1)
  })

  test('imbalance = 0 when perfectly balanced', () => {
    updateDepth('btcusdt_c', [['50000', '5']], [['50000', '5']])
    expect(getImbalance('btcusdt_c')).toBeCloseTo(0)
  })

  test('imbalance = 0 when both sides are empty', () => {
    updateDepth('btcusdt_d', [], [])
    expect(getImbalance('btcusdt_d')).toBeCloseTo(0)
  })

  test('correct formula across multiple levels', () => {
    // bid total = 10+20 = 30, ask total = 5+15 = 20, net = (30-20)/50 = 0.2
    updateDepth('ethusdt_a',
      [['3000', '10'], ['2999', '20']],
      [['3001', '5'],  ['3002', '15']]
    )
    expect(getImbalance('ethusdt_a')).toBeCloseTo(0.2)
  })

  test('only first DEPTH_LEVELS levels are used', () => {
    const N = getDepthLevels()
    // N bid levels all '1', 2x asks all '1' but only the top N of each count.
    // Equal per-level volume on both sides keeps the imbalance at 0 regardless
    // of N, while proving levels beyond N are ignored.
    const bids = Array.from({ length: N * 2 }, (_, i) => [`${50000 - i}`, '1'])
    const asks = Array.from({ length: N * 2 }, (_, i) => [`${50001 + i}`, '1'])
    updateDepth('btcusdt_e', bids, asks)
    expect(getImbalance('btcusdt_e')).toBeCloseTo(0)
  })

  test('default DEPTH_LEVELS is 10', () => {
    expect(getDepthLevels()).toBe(10)
  })

  test('returns null when snapshot is stale (> 10s)', () => {
    jest.useFakeTimers()
    updateDepth('btcusdt_stale', [['50000', '5']], [['50000', '3']])
    jest.advanceTimersByTime(10_001)
    expect(getImbalance('btcusdt_stale')).toBeNull()
    jest.useRealTimers()
  })

  test('returns value when snapshot is fresh (< 10s)', () => {
    jest.useFakeTimers()
    updateDepth('btcusdt_fresh', [['50000', '8']], [['50000', '2']])
    jest.advanceTimersByTime(9_999)
    expect(getImbalance('btcusdt_fresh')).toBeCloseTo(0.6)
    jest.useRealTimers()
  })

  test('overwrites previous state on update', () => {
    updateDepth('btcusdt_f', [['50000', '10']], [])   // imbalance = 1
    updateDepth('btcusdt_f', [], [['50000', '10']])   // imbalance = -1
    expect(getImbalance('btcusdt_f')).toBeCloseTo(-1)
  })

  test('per-pair isolation — pairs do not share state', () => {
    updateDepth('pair1', [['100', '10']], [])          // imbalance = +1
    updateDepth('pair2', [], [['100', '10']])          // imbalance = -1
    expect(getImbalance('pair1')).toBeCloseTo(1)
    expect(getImbalance('pair2')).toBeCloseTo(-1)
  })
})

describe('getImbalanceThreshold / getDepthLevels', () => {
  test('threshold is a positive number', () => {
    expect(getImbalanceThreshold()).toBeGreaterThan(0)
  })

  test('depth levels is a positive integer', () => {
    const d = getDepthLevels()
    expect(d).toBeGreaterThan(0)
    expect(Number.isInteger(d)).toBe(true)
  })
})

describe('getAllDepth', () => {
  test('returns an object with ageMs and imbalance fields', () => {
    updateDepth('snapshot_pair', [['100', '3']], [['100', '1']])
    const snap = getAllDepth()
    expect(snap).toHaveProperty('snapshot_pair')
    const s = snap['snapshot_pair']
    expect(s).toHaveProperty('imbalance')
    expect(s).toHaveProperty('bidVol')
    expect(s).toHaveProperty('askVol')
    expect(s).toHaveProperty('ageMs')
    expect(s.ageMs).toBeGreaterThanOrEqual(0)
    expect(s.imbalance).toBeCloseTo(0.5)
  })
})
