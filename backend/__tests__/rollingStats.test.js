/**
 * Tests for rollingStats.js — Welford's online algorithm with sliding window.
 *
 * Why these tests matter:
 *   The retraction formula (Chan's algorithm for evicting old samples) is
 *   non-obvious. A naive implementation might recompute from scratch (O(n))
 *   or accumulate float errors. These tests verify correctness against known
 *   ground truths and catch regressions in the O(1) eviction path.
 */

// Each test gets a fresh module instance so state doesn't bleed between tests.
let stats
beforeEach(() => {
  jest.resetModules()
  stats = require('../services/rollingStats')
})

// ─── Helpers ────────────────────────────────────────────────────────────────

// Population std of an array (for sanity-checking against known values).
function popStd(arr) {
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length)
}

// Sample std (ddof=1) — what Welford's computes.
function sampleStd(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1))
}

const PAIR = 'BTCUSDT'
const EPS  = 1e-9   // float tolerance

// ─── Basic convergence ───────────────────────────────────────────────────────

test('mean converges to true mean after N updates', () => {
  const values = [10, 20, 30, 40, 50]
  let result
  for (const v of values) result = stats.update(PAIR, v)
  expect(result.mean).toBeCloseTo(30, 10)
  expect(result.n).toBe(5)
})

test('std converges to sample std after N updates', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9]
  for (const v of values) stats.update(PAIR, v)
  const expected = sampleStd(values)
  const { mean, std } = stats.update(PAIR, values[values.length - 1])
  // Re-run properly: reset and feed all
  jest.resetModules()
  stats = require('../services/rollingStats')
  let r
  for (const v of values) r = stats.update(PAIR, v)
  expect(r.std).toBeCloseTo(expected, 8)
})

test('std is 0 for a single observation', () => {
  const r = stats.update(PAIR, 42)
  expect(r.std).toBe(0)
  expect(r.n).toBe(1)
})

test('std is 0 when all values are identical', () => {
  for (let i = 0; i < 10; i++) stats.update(PAIR, 100)
  expect(stats.zScore(PAIR, 100)).toBeNull() // std=0 → null
})

// ─── z-score ────────────────────────────────────────────────────────────────

test('zScore returns null before MIN_SAMPLES observations', () => {
  // MIN_SAMPLES defaults to 30; feed 29 values
  for (let i = 0; i < 29; i++) stats.update(PAIR, 100)
  expect(stats.zScore(PAIR, 200)).toBeNull()
})

// Feed a varied distribution (1..50) so std > 0 for these directional tests.
function feedRange(n = 50) {
  for (let i = 1; i <= n; i++) stats.update(PAIR, i)
}

test('zScore is approximately 0 for value equal to mean', () => {
  feedRange()   // mean = 25.5
  const z = stats.zScore(PAIR, 25.5)
  expect(Math.abs(z)).toBeLessThan(EPS)
})

test('zScore is positive for values above mean', () => {
  feedRange()
  expect(stats.zScore(PAIR, 1000)).toBeGreaterThan(0)
})

test('zScore is negative for values below mean', () => {
  feedRange()
  expect(stats.zScore(PAIR, 0)).toBeLessThan(0)
})

test('zScore of mean+1std is approximately 1.0', () => {
  // Feed values 1..100 (sample std ≈ 29.01)
  for (let i = 1; i <= 100; i++) stats.update(PAIR, i)
  const mean = 50.5
  const std  = sampleStd(Array.from({ length: 100 }, (_, i) => i + 1))
  const z = stats.zScore(PAIR, mean + std)
  expect(z).toBeCloseTo(1.0, 6)
})

// ─── Sliding window / eviction (the tricky part) ────────────────────────────

test('window eviction keeps n bounded at WINDOW_SIZE', () => {
  // WINDOW_SIZE defaults to 500; overfeed it
  for (let i = 0; i < 600; i++) stats.update(PAIR, i)
  const r = stats.update(PAIR, 600)
  expect(r.n).toBe(500)
})

test('mean updates correctly after old values are evicted', () => {
  // Feed 500 ones, then 500 twos — after eviction window should contain only twos
  for (let i = 0; i < 500; i++) stats.update(PAIR, 1)
  for (let i = 0; i < 500; i++) stats.update(PAIR, 2)
  const r = stats.update(PAIR, 2)
  // Window is now [2, 2, 2, ... 2] (500 twos + last one we just added = 501 total but bounded at 500)
  expect(r.mean).toBeCloseTo(2, 6)
  expect(r.std).toBeCloseTo(0, 6)
})

test('std is numerically stable for large values (no catastrophic cancellation)', () => {
  // Naive variance formula (E[x²] - E[x]²) breaks for large values with small variance.
  // Welford's should handle this correctly.
  const base  = 1_000_000
  const noise = 1
  for (let i = 0; i < 100; i++) {
    stats.update(PAIR, base + (i % 2 === 0 ? noise : -noise))
  }
  const r = stats.update(PAIR, base)
  // std should be close to 1 (noise amplitude), not blown up by float cancellation
  expect(r.std).toBeCloseTo(noise, 0)
  expect(r.mean).toBeCloseTo(base, 0)
})

// ─── Per-symbol isolation ────────────────────────────────────────────────────

test('different symbols maintain independent state', () => {
  // Feed varied distributions so std > 0 for both symbols
  for (let i = 1; i <= 50; i++) stats.update('BTCUSDT', i * 100)
  for (let i = 1; i <= 50; i++) stats.update('ETHUSDT', i * 10)

  const meanBtc = 2550, meanEth = 255
  const stdBtc  = sampleStd(Array.from({ length: 50 }, (_, i) => (i + 1) * 100))
  const stdEth  = sampleStd(Array.from({ length: 50 }, (_, i) => (i + 1) * 10))

  // A 5σ spike on each: z-scores should match since distributions are scaled versions
  const zBtc = stats.zScore('BTCUSDT', meanBtc + 5 * stdBtc)
  const zEth = stats.zScore('ETHUSDT', meanEth + 5 * stdEth)

  expect(zBtc).not.toBeNull()
  expect(zEth).not.toBeNull()
  expect(zBtc).toBeCloseTo(5.0, 4)
  expect(zEth).toBeCloseTo(5.0, 4)
})

test('getAllStats returns an entry for every updated symbol', () => {
  stats.update('BTCUSDT', 100)
  stats.update('ETHUSDT', 10)
  stats.update('SOLUSDT', 5)
  const all = stats.getAllStats()
  expect(Object.keys(all)).toEqual(expect.arrayContaining(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']))
})
