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
