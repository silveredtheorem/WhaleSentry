const path = require('path')
const ENABLE_DB = (process.env.ENABLE_DB || '').toLowerCase() === 'true'
let db = null

if (ENABLE_DB) {
  try {
    const sqlite3 = require('sqlite3').verbose()
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'whales.db')
    db = new sqlite3.Database(dbPath)
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS whales (
        id TEXT PRIMARY KEY,
        pair TEXT,
        price REAL,
        quantity REAL,
        value REAL,
        type TEXT,
        whaleType TEXT,
        timestamp INTEGER,
        tradeCount INTEGER,
        totalValue REAL
      )`)
    })
    console.log('✅ SQLite DB initialized at', dbPath)
  } catch (err) {
    console.error('Failed to initialize sqlite3:', err)
    db = null
  }
} else {
  console.log('ℹ️ DB disabled (set ENABLE_DB=true to enable)')
}

function insertWhale(obj) {
  if (!db) return Promise.resolve(false)
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO whales (id,pair,price,quantity,value,type,whaleType,timestamp,tradeCount,totalValue) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    stmt.run(
      obj.id,
      obj.pair || null,
      obj.price || 0,
      obj.quantity || 0,
      obj.value || 0,
      obj.type || null,
      obj.whaleType || null,
      obj.timestamp || Date.now(),
      obj.tradeCount || 1,
      obj.totalValue || obj.value || 0,
      function (err) {
        stmt.finalize()
        if (err) return reject(err)
        resolve(true)
      }
    )
  })
}

module.exports = { insertWhale }
