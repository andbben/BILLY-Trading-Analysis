-- Bill Bronco Trading Analysis - Database Schema
-- Run this file in your PostgreSQL database to set up all tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios table (each user has one default portfolio)
CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'My Portfolio',
  cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 50000.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_portfolio UNIQUE(user_id)
);

-- Positions table (stocks in a portfolio)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  shares DECIMAL(14, 4) NOT NULL,
  avg_cost DECIMAL(14, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ticker_per_portfolio UNIQUE(portfolio_id, ticker)
);

-- Trade history for buy/sell workflow
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  shares DECIMAL(14, 4) NOT NULL,
  price DECIMAL(14, 4) NOT NULL,
  total DECIMAL(14, 2) NOT NULL,
  account_id VARCHAR(80),
  account_label VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cash transfer history for bank/Billy cash movement
CREATE TABLE IF NOT EXISTS cash_transfers (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  transfer_type VARCHAR(30) NOT NULL,
  from_account VARCHAR(80) NOT NULL,
  from_label VARCHAR(255) NOT NULL,
  from_type VARCHAR(20) NOT NULL,
  to_account VARCHAR(80) NOT NULL,
  to_label VARCHAR(255) NOT NULL,
  to_type VARCHAR(20) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  memo TEXT,
  occurrence VARCHAR(20) NOT NULL DEFAULT 'one_time',
  recurring_option VARCHAR(30),
  frequency VARCHAR(30),
  start_date DATE,
  end_date DATE,
  transaction_id VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional established Billy accounts and share-transfer history
CREATE TABLE IF NOT EXISTS billy_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  account_number VARCHAR(24) NOT NULL,
  cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billy_account_positions (
  id SERIAL PRIMARY KEY,
  billy_account_id INTEGER NOT NULL REFERENCES billy_accounts(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  shares DECIMAL(14, 4) NOT NULL,
  avg_cost DECIMAL(14, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_ticker_per_billy_account UNIQUE(billy_account_id, ticker)
);

CREATE TABLE IF NOT EXISTS asset_transfers (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  from_account VARCHAR(80) NOT NULL,
  from_label VARCHAR(255) NOT NULL,
  to_account VARCHAR(80) NOT NULL,
  to_label VARCHAR(255) NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  shares DECIMAL(14, 4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  transaction_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connected_bank_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(60) NOT NULL,
  routing_last4 VARCHAR(4) NOT NULL,
  account_last4 VARCHAR(4) NOT NULL,
  demo_balance DECIMAL(14, 2) NOT NULL,
  agreements JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billy_analyst_actions (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  account_id VARCHAR(80) NOT NULL,
  account_label VARCHAR(255) NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  action VARCHAR(20) NOT NULL,
  initial_fund DECIMAL(14, 2) NOT NULL,
  invested_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  shares DECIMAL(14, 4) NOT NULL DEFAULT 0,
  max_investment_dollars DECIMAL(14, 2),
  max_investment_percent DECIMAL(8, 4),
  max_loss_dollars DECIMAL(14, 2),
  max_loss_percent DECIMAL(8, 4),
  reinvest_gains BOOLEAN NOT NULL DEFAULT false,
  confidence DECIMAL(8, 4),
  rationale TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cached deterministic/optional AI article analysis
CREATE TABLE IF NOT EXISTS article_analysis_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(64) NOT NULL UNIQUE,
  article_url TEXT,
  headline TEXT,
  source VARCHAR(255),
  analysis JSONB NOT NULL,
  analysis_source VARCHAR(40) NOT NULL DEFAULT 'deterministic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist table (stocks user wants to track)
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_ticker UNIQUE(user_id, ticker)
);

-- Alerts table (price, technical, and news alerts)
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker VARCHAR(10) NOT NULL,
  alert_kind VARCHAR(20) NOT NULL DEFAULT 'price',
  alert_type VARCHAR(30) NOT NULL DEFAULT 'above',
  condition TEXT NOT NULL DEFAULT 'above',
  price_target DECIMAL(14, 4),
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compatibility updates for existing local databases that were created from an older schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'free';
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 50000.00;
ALTER TABLE positions ALTER COLUMN shares TYPE DECIMAL(14, 4);
ALTER TABLE positions ALTER COLUMN avg_cost TYPE DECIMAL(14, 4);
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_alert_type_check;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_kind VARCHAR(20) NOT NULL DEFAULT 'price';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'above';
ALTER TABLE alerts ALTER COLUMN price_target DROP NOT NULL;
ALTER TABLE alerts ALTER COLUMN price_target TYPE DECIMAL(14, 4);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS occurrence VARCHAR(20) NOT NULL DEFAULT 'one_time';
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS recurring_option VARCHAR(30);
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS frequency VARCHAR(30);
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id VARCHAR(80);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_label VARCHAR(255);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_portfolio_id ON cash_transfers(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_billy_accounts_user_id ON billy_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_billy_account_positions_account_id ON billy_account_positions(billy_account_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_portfolio_id ON asset_transfers(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_connected_bank_accounts_user_id ON connected_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_billy_analyst_actions_portfolio_id ON billy_analyst_actions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_article_analysis_cache_key ON article_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
