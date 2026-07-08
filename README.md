# Whale Sentry

Real-time crypto whale trade detection dashboard. Streams live trade and order book data from Binance, applies rolling z-score and order book imbalance signals to flag large trades, and broadcasts alerts to connected clients via Socket.IO.

## Quick start

```bash
# Backend
cd backend && npm install && npm start

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Copy `.env.example` to `backend/.env` to customize thresholds, pairs, and window sizes.

## Docker

```bash
docker compose up --build
```

Frontend served at port 80, backend at port 3000.

## Features

- Multi-pair Binance WebSocket streaming (trade + order book depth)
- Three detection methods: static dollar threshold, rolling z-score (Welford's algorithm), composite z-score + order book imbalance
- Smart pair selector — Coin B constrained to valid trading partners
- Live price chart with VWAP overlay, trade feed, whale alert toasts, leaderboard
- Exponential backoff reconnection with Socket.IO event replay for new clients
- SQLite3 persistence with batch INSERT; historical query via `GET /api/whales`
- Performance panel: queue depth, consumer lag, uptime

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Server, Binance connection, rolling stats, order book state |
| `GET /api/whales` | Historical whale alerts (params: `pair`, `from`, `to`, `method`, `tier`, `limit`) |
| `GET /api/thresholds` | Current detection thresholds |
| `POST /api/thresholds` | Update thresholds live |
| `POST /api/detection-window` | Update aggregation window |

## Tech

React · Vite · Tailwind CSS · Node.js · Express · Socket.IO · SQLite3 · WebSocket · Docker
