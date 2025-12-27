// analytics helpers: VWAP, aggregation, accumulation/distribution

export function computeVWAP(trades = [], windowMs = 60 * 60 * 1000) {
  const cutoff = Date.now() - windowMs
  const windowTrades = trades.filter(t => t.timestamp >= cutoff)
  let pv = 0, v = 0
  for (const t of windowTrades) {
    pv += t.price * t.quantity
    v += t.quantity
  }
  return v === 0 ? null : pv / v
}

export function accumulationDistribution(trades = [], windowMs = 60 * 60 * 1000) {
  const cutoff = Date.now() - windowMs
  const windowTrades = trades.filter(t => t.timestamp >= cutoff)
  let buyVol = 0, sellVol = 0
  for (const t of windowTrades) {
    if (t.type === 'BUY') buyVol += t.quantity * t.price
    else sellVol += t.quantity * t.price
  }
  return { buyVol, sellVol, net: buyVol - sellVol }
}

export function aggregateByInterval(trades = [], intervalMs = 60 * 1000) {
  // returns array of { time, price, volume }
  if (!trades.length) return []
  const sorted = [...trades].sort((a,b)=>a.timestamp - b.timestamp)
  const start = sorted[0].timestamp
  const buckets = new Map()
  for (const t of sorted) {
    const idx = Math.floor((t.timestamp - start) / intervalMs)
    const key = start + idx * intervalMs
    if (!buckets.has(key)) buckets.set(key, { time: key, priceSum: 0, vol: 0 })
    const b = buckets.get(key)
    b.priceSum += t.price * t.quantity
    b.vol += t.quantity
  }
  const out = []
  for (const [k, v] of buckets) {
    out.push({ time: new Date(k).toLocaleTimeString(), price: v.vol ? v.priceSum / v.vol : 0, volume: v.vol })
  }
  return out
}
