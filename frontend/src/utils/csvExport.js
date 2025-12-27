export function exportWhalesCSV(whales = [], filename = 'whales.csv') {
  if (!whales || whales.length === 0) return
  const headers = ['id','timestamp','time','value','price','quantity','type','whaleType']
  const rows = whales.map(w => [w.id, w.timestamp, w.time, w.value, w.price, w.quantity, w.type, w.whaleType])
  const csv = [headers, ...rows].map(r => r.map(cell => {
    if (cell === null || cell === undefined) return ''
    return String(cell).replace(/"/g, '""')
  }).map(c => `"${c}"`).join(',')).join('\n')

  // Use the escaped csv (falls back to simple join earlier if needed)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
