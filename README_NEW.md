# Whale Sentry 3000

Real-time BTC/USDT whale detection & alerting system (backend + frontend).

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

## Features

- Real-time Binance trade streaming (BTC/USDT)
- Whale detection with adjustable thresholds (Dolphin / Whale / Megalodon)
- Live trade feed grouped by trade size
- Floating whale alerts with visual + audio cues
- VWAP analytics, multi-timeframe aggregation, and leaderboard
- CSV export of whale alerts
- Dark mode and polished cyberpunk UI

## Endpoints

- `GET /api/health` — basic server + stream status
- `GET /api/recent-trades` — recent trade history
- `GET /api/thresholds` — current in-memory thresholds
- `POST /api/test-whale` — emit a test whale alert (dev utility)

## Notes

- Backend connects to Binance WebSocket and emits `trade` and `whale-alert` events via Socket.IO.
- Frontend connects with Socket.IO and displays live charts and alerts.
- Thresholds are stored in-memory; use the Thresholds panel to adjust them live.

## Next steps / production

- Persist thresholds to disk or a DB so they survive restarts.
- Add authentication and role restrictions for threshold changes.
- Deploy behind a reverse proxy (nginx) with TLS and a process manager (pm2).

---

Whale Sentry 3000 — watch the market, spot the whales.
