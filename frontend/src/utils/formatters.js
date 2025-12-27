export function formatUSD(value) {
  if (!value && value !== 0) return '-'
  const n = Number(value)
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function formatBTC(value) {
  if (!value && value !== 0) return '-'
  return `${Number(value).toFixed(4)} BTC`
}
