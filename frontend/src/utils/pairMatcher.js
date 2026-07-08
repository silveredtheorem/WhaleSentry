/**
 * Filter trades/alerts by exact coin pair match
 * @param {Array} items - trades or whale alerts
 * @param {string} coinA - coin A (e.g. 'BTC')
 * @param {string} coinB - coin B (e.g. 'USDT')
 * @returns {Array} - filtered items matching exact pair
 */
export function filterByPair(items, coinA, coinB) {
  if (!coinA || !coinB || !Array.isArray(items)) return items;
  
  const upperA = String(coinA).toUpperCase();
  const upperB = String(coinB).toUpperCase();
  const pair1 = upperA + upperB;
  const pair2 = upperB + upperA;
  
  return items.filter((item) => {
    if (!item.pair) return false;
    const pairUpper = String(item.pair).toUpperCase();
    return pairUpper === pair1 || pairUpper === pair2;
  });
}

/**
 * Check if a trade matches the selected coin pair
 * @param {Object} trade - trade object
 * @param {string} coinA 
 * @param {string} coinB 
 * @returns {boolean}
 */
export function tradeMatchesPair(trade, coinA, coinB) {
  if (!trade || !trade.pair || !coinA || !coinB) return false;
  const upperA = String(coinA).toUpperCase();
  const upperB = String(coinB).toUpperCase();
  const pairUpper = String(trade.pair).toUpperCase();
  return pairUpper === (upperA + upperB) || pairUpper === (upperB + upperA);
}

// Known Binance quote currencies, longest symbol first so e.g. "USDT" is tried
// before "USD" -- sorted by length here instead of by hand, so adding a new
// quote currency below can never silently break matching by being in the
// wrong order (the previous bug class: a 3-letter quote placed before a
// same-prefixed 4-letter quote would have stolen its suffix match).
const QUOTE_CURRENCIES = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USDE', 'EUR', 'GBP', 'USD', 'BTC', 'ETH']
  .sort((a, b) => b.length - a.length);

/**
 * Split a single market symbol like "BTCUSDT" into its base/quote tokens.
 * Returns null if no known quote currency matches the suffix.
 * @param {string} pair - e.g. 'BTCUSDT', 'ETHBTC'
 * @returns {{ base: string, quote: string } | null}
 */
export function splitPairSymbol(pair) {
  const up = String(pair || '').toUpperCase();
  for (const quote of QUOTE_CURRENCIES) {
    if (up.endsWith(quote)) {
      const base = up.slice(0, up.length - quote.length);
      if (base.length > 0) return { base, quote };
    }
  }
  return null;
}

/**
 * Given a token (base or quote) and the full list of streamed pair symbols,
 * return only the tokens that form a real stream with it.
 * @param {string} tokenA
 * @param {string[]} pairs - e.g. ['BTCUSDT', 'ETHBTC', ...]
 * @returns {string[]} sorted partners
 */
export function getValidPartnersFor(tokenA, pairs) {
  const up = String(tokenA || '').toUpperCase()
  const partners = new Set()
  for (const pair of (Array.isArray(pairs) ? pairs : [])) {
    const split = splitPairSymbol(pair)
    if (!split) continue
    if (split.base === up) partners.add(split.quote)
    if (split.quote === up) partners.add(split.base)
  }
  return Array.from(partners).sort()
}

/**
 * Derive the set of unique base/quote tokens (e.g. ['BTC', 'USDT', ...]) seen
 * across a list of market symbols, for populating coin selector dropdowns.
 * Pairs that don't match a known quote currency are skipped rather than
 * guessed at, since a wrong split would silently send a token list that
 * doesn't correspond to any real stream.
 * @param {string[]} pairs
 * @returns {string[]} sorted, deduplicated token list
 */
export function deriveTokensFromPairs(pairs) {
  const tokens = new Set();
  (Array.isArray(pairs) ? pairs : [pairs]).forEach(p => {
    const split = splitPairSymbol(p);
    if (split) {
      tokens.add(split.base);
      tokens.add(split.quote);
    }
  });
  return Array.from(tokens).filter(Boolean).sort();
}
