# Whale Watcher

Real-time BTC/USDT whale detection system (backend + frontend).

## Quick start

Backend

```bash
cd backend
npm install
npm start
```

Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at the URL shown by Vite (usually http://localhost:5173).

Notes
- Backend connects to Binance WebSocket and emits `trade` and `whale-alert` events via Socket.IO.
- Frontend displays price chart, alerts, and plays a short sound when whales are detected.

Polish & features added
- VWAP overlay on chart
- Multi-timeframe aggregation (5m,15m,1h,4h)
- Performance panel: messages/sec, latency, uptime
- Animated whale alerts with shake effect for >$5M trades
- CSV export of whale alerts and leaderboard
- Dark mode toggle (reload to apply)

Troubleshooting
- If frontend cannot connect, ensure backend is running on port 3000 and CORS allowed.
- If Binance WS isn't connecting, check network/firewall or API limits.
