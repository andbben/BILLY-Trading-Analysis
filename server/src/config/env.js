require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'CLIENT_URL', 'FINNHUB_API_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3001),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGINS || `${process.env.CLIENT_URL},http://127.0.0.1:5173`)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
  AI_API_KEY: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
  ANTHROPIC_VERSION: process.env.ANTHROPIC_VERSION || '2023-06-01',
  ENABLE_AI_ANALYSIS: process.env.ENABLE_AI_ANALYSIS === 'true',
};

module.exports = env;
