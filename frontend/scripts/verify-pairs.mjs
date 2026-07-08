#!/usr/bin/env node
// Plain Node script (no test framework) that checks every pair the backend
// actually streams (backend/server.js DEFAULT_PAIRS) splits into the correct
// base/quote tokens via splitPairSymbol(). Run with:
//   node frontend/scripts/verify-pairs.mjs

import { splitPairSymbol, deriveTokensFromPairs } from '../src/utils/pairMatcher.js'

// Mirrors backend/server.js DEFAULT_PAIRS. Kept here (not imported) since the
// backend is a separate CommonJS module and this is just a verification check.
const DEFAULT_PAIRS = [
  'btcusdt', 'ethusdt', 'bnbusdt', 'adausdt', 'xrpusdt', 'dogeusdt', 'solusdt', 'dotusdt', 'ltcusdt', 'bchusdt',
  'maticusdt', 'linkusdt', 'trxusdt', 'atomusdt', 'avaxusdt', 'ftmusdt', 'vetusdt', 'eosusdt', 'nearusdt', 'xlmusdt',
  'ethbtc', 'bnbbtc', 'xrpbtc', 'ltcbtc', 'bchbtc', 'dotbtc', 'linkbtc',
  'bnbeth', 'xrpeth', 'ltceth', 'linketh', 'adaeth'
]

// expected[symbol] = [base, quote]
const EXPECTED = {
  BTCUSDT: ['BTC', 'USDT'], ETHUSDT: ['ETH', 'USDT'], BNBUSDT: ['BNB', 'USDT'], ADAUSDT: ['ADA', 'USDT'],
  XRPUSDT: ['XRP', 'USDT'], DOGEUSDT: ['DOGE', 'USDT'], SOLUSDT: ['SOL', 'USDT'], DOTUSDT: ['DOT', 'USDT'],
  LTCUSDT: ['LTC', 'USDT'], BCHUSDT: ['BCH', 'USDT'], MATICUSDT: ['MATIC', 'USDT'], LINKUSDT: ['LINK', 'USDT'],
  TRXUSDT: ['TRX', 'USDT'], ATOMUSDT: ['ATOM', 'USDT'], AVAXUSDT: ['AVAX', 'USDT'], FTMUSDT: ['FTM', 'USDT'],
  VETUSDT: ['VET', 'USDT'], EOSUSDT: ['EOS', 'USDT'], NEARUSDT: ['NEAR', 'USDT'], XLMUSDT: ['XLM', 'USDT'],
  ETHBTC: ['ETH', 'BTC'], BNBBTC: ['BNB', 'BTC'], XRPBTC: ['XRP', 'BTC'], LTCBTC: ['LTC', 'BTC'],
  BCHBTC: ['BCH', 'BTC'], DOTBTC: ['DOT', 'BTC'], LINKBTC: ['LINK', 'BTC'],
  BNBETH: ['BNB', 'ETH'], XRPETH: ['XRP', 'ETH'], LTCETH: ['LTC', 'ETH'], LINKETH: ['LINK', 'ETH'], ADAETH: ['ADA', 'ETH']
}

let failures = 0

console.log(`Verifying ${DEFAULT_PAIRS.length} default pairs...\n`)

for (const raw of DEFAULT_PAIRS) {
  const symbol = raw.toUpperCase()
  const expected = EXPECTED[symbol]
  const result = splitPairSymbol(symbol)

  if (!expected) {
    console.log(`? ${symbol} -- no expected value defined in this script`)
    continue
  }
  if (!result) {
    console.error(`FAIL ${symbol} -> no match (expected ${expected.join('/')})`)
    failures++
    continue
  }
  const ok = result.base === expected[0] && result.quote === expected[1]
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${symbol} -> ${result.base}/${result.quote}${ok ? '' : ` (expected ${expected.join('/')})`}`)
  if (!ok) failures++
}

const tokens = deriveTokensFromPairs(DEFAULT_PAIRS.map(p => p.toUpperCase()))
console.log(`\nDerived ${tokens.length} unique tokens: ${tokens.join(', ')}`)

if (failures > 0) {
  console.error(`\n${failures} pair(s) failed to parse correctly.`)
  process.exit(1)
} else {
  console.log(`\nAll ${DEFAULT_PAIRS.length} pairs parsed correctly.`)
}
