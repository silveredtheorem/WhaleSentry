// Fixed-capacity ring buffer that decouples ingestion (WebSocket message handler)
// from processing (classify/broadcast/DB-insert). When full, the oldest unprocessed
// trade is dropped — under load we prefer fresh data over a deep backlog.
const CAPACITY = Number(process.env.TRADE_QUEUE_CAPACITY) || 5000

class TradeQueue {
  constructor(capacity = CAPACITY) {
    this.capacity = capacity
    this.buf = []
    this.droppedCount = 0
    this.processedCount = 0
    this.lastLagMs = 0
  }

  enqueue(item) {
    if (this.buf.length >= this.capacity) {
      this.buf.shift()
      this.droppedCount++
    }
    this.buf.push({ ...item, _enqueuedAt: Date.now() })
  }

  drainAll() {
    const out = this.buf
    this.buf = []
    return out
  }

  depth() {
    return this.buf.length
  }

  recordProcessed(count, lagMs) {
    this.processedCount += count
    this.lastLagMs = lagMs
  }

  getMetrics() {
    return {
      depth: this.depth(),
      capacity: this.capacity,
      droppedCount: this.droppedCount,
      processedCount: this.processedCount,
      lastLagMs: this.lastLagMs
    }
  }
}

module.exports = { TradeQueue }
