# DDLJ Trading System v9.1.0

EMA-based trend-following options trading system for BankNifty/Nifty on Kite/Zerodha.

## Architecture

```
ddlj-trading-system/
├── frontend/          # Next.js 16 dashboard (this repo root)
├── backend/           # FastAPI Python backend
│   ├── engine/        # Core strategy engine (Bias, Signal, Options, Backtester)
│   ├── api/           # REST API + WebSocket routes
│   ├── services/      # Token refresh, Telegram, Health monitor
│   ├── database/      # SQLite + migrations
│   └── core/          # Config, logging, exceptions
├── ddlj_v9/           # Original strategy scripts (reference)
└── shared/            # Shared types/constants
```

## Frontend (Next.js 16)

```bash
cd /frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
```

### Pages
- **Dashboard** — Live P&L, positions, market overview
- **Engine** — Bias engine + signal engine status
- **Trades** — Active trades & trade history
- **Config** — 14-section configuration (all from UI)
- **Backtest** — Run backtests with strategy presets
- **Token** — Kite access token management
- **Health** — System health monitoring
- **Options** — Options chain + Black-Scholes
- **Risk** — Risk metrics & position sizing
- **Alerts** — Telegram alerts & notifications
- **Journal** — Trading journal & notes

## Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### API Endpoints
- `GET /api/health` — System health
- `GET /api/config` — Get all config sections
- `PUT /api/config/{section}` — Update config section
- `GET /api/trades` — Active trades
- `POST /api/backtest/run` — Run backtest
- `WS /ws` — Real-time WebSocket updates

## Environment Variables

```env
# Kite API
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_ACCESS_TOKEN=refreshed_daily

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Database
DATABASE_URL=sqlite:///./ddlj.db

# Backend
HOST=0.0.0.0
PORT=8000
```

## Deployment

- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase (PostgreSQL) or SQLite

## License

Private — All rights reserved.
