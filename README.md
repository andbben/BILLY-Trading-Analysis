# Billy Bronco Market Analyst

Billy Bronco is a React + Express stock market analysis app for portfolio tracking, watchlists, alerts, market news, technical indicators, and demo subscription plans.

## Project Structure

```txt
client/   React + Vite frontend
server/   Express API, PostgreSQL access, market-data proxy
```

The standalone `BILLY-Trading-Analysis/billy-bronco-gated.html` was used as the source for the richer UI and feature set. The active app now lives in `client/` and `server/`.

## Requirements

- Node.js
- PostgreSQL
- Finnhub API key

## Server Environment

Create `server/.env` from `server/.env.example`.

Required:

```txt
DATABASE_URL=postgres://postgres:your_password_here@localhost:5432/bill_bronco
JWT_SECRET=replace_with_a_strong_secret
CLIENT_URL=http://localhost:5173
FINNHUB_API_KEY=replace_with_your_finnhub_key
```

Optional:

```txt
AI_API_KEY=
AI_MODEL=claude-sonnet-4-20250514
ENABLE_AI_ANALYSIS=false
```

By default, article analysis uses Finnhub headline/summary plus deterministic keyword sentiment. Generative AI summaries are disabled unless `ENABLE_AI_ANALYSIS=true` and `AI_API_KEY` is configured.

## Database Setup

Run the schema against your PostgreSQL database:

```bash
psql "$DATABASE_URL" -f server/src/db/schema.sql
```

The schema includes users, portfolios, positions, trades, watchlists, alerts, user plans, and article analysis cache.

If the schema changes later, rerun `server/src/db/schema.sql`; it uses `CREATE TABLE IF NOT EXISTS` and compatibility `ALTER TABLE` statements where practical.

## Run Locally

Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

Start the API:

```bash
cd server
npm run dev
```

Start the frontend:

```bash
cd client
npm run dev
```

Open:

```txt
http://localhost:5173
```

API health check:

```txt
http://localhost:3001/api/health
```

## Test And Build

Frontend:

```bash
cd client
npm run lint
npm run build
```

Backend:

```bash
cd server
npm test
```

Backend tests cover:

- auth register/login
- portfolio buy/sell trades
- alerts create/toggle/delete
- selected plan persistence

## Market Data

The frontend calls server routes under `/api/market`. The server calls Finnhub and caches responses in memory:

- quotes: short cache
- market news: 5 minutes
- company news: 5 minutes
- candles: long cache

This keeps the Finnhub key out of browser code and reduces API usage.

## Article Analysis

`POST /api/market/news/analyze` returns structured article analysis.

Default behavior:

- uses headline and summary from Finnhub
- applies keyword sentiment
- generates deterministic `abstract`, `marketImpact`, `keyPoints`, and `watchFor`
- stores results in `article_analysis_cache`

Optional future behavior:

- enable generative AI with `ENABLE_AI_ANALYSIS=true`
- keep cache enabled to control cost and latency

## Payments And Plans

The Plans page currently uses a demo checkout. No real payment is processed.

What is already in place for future payment work:

- `users.plan` in PostgreSQL
- `PATCH /api/users/plan`
- frontend plan selection flow

A future Stripe implementation can add checkout sessions, webhooks, billing status, and plan enforcement without replacing the current UI.

## Current Limitations

- Market data uses REST polling, not Finnhub WebSocket streaming.
- Article analysis is deterministic by default, not generative.
- Payments are demo-only.
- Market cache is in memory, so it resets when the server restarts.
