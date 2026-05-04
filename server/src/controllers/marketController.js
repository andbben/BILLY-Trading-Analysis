const crypto = require('crypto');
const env = require('../config/env');
const pool = require('../db/pool');

const FH_BASE = 'https://finnhub.io/api/v1';
const cache = new Map();

const TTL = {
  quote: 20 * 1000,
  marketNews: 5 * 60 * 1000,
  companyNews: 5 * 60 * 1000,
  candles: 12 * 60 * 60 * 1000,
};

function cacheKey(parts) {
  return parts.filter(Boolean).join(':');
}

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) {
    return hit.value;
  }

  const value = await loader();
  cache.set(key, { value, ts: Date.now() });
  return value;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || data.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function withToken(path) {
  const joiner = path.includes('?') ? '&' : '?';
  return `${FH_BASE}${path}${joiner}token=${encodeURIComponent(env.FINNHUB_API_KEY)}`;
}

function classifySentiment(headline = '', summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();
  const bull = ['surge', 'jump', 'rally', 'gain', 'beat', 'record', 'growth', 'profit', 'rise', 'boost', 'strong', 'positive', 'bullish', 'upgrade', 'soar'];
  const bear = ['fall', 'drop', 'decline', 'miss', 'loss', 'down', 'weak', 'negative', 'bearish', 'cut', 'crash', 'fear', 'concern', 'risk', 'disappoint', 'slump'];
  const bullHits = bull.filter((word) => text.includes(word)).length;
  const bearHits = bear.filter((word) => text.includes(word)).length;

  if (bullHits > bearHits) return { sentiment: 'bull', score: Math.min(10, 6 + bullHits * 0.8) };
  if (bearHits > bullHits) return { sentiment: 'bear', score: Math.max(0, 4 - bearHits * 0.8) };
  return { sentiment: 'neutral', score: 5 };
}

function articleCacheKey(article = {}) {
  const stable = article.url || `${article.source || ''}|${article.headline || article.title || ''}|${article.datetime || ''}`;
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function deterministicAnalysis(article = {}) {
  const headline = article.headline || article.title || 'Market update';
  const summary = article.summary || headline;
  const related = String(article.related || '')
    .split(',')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
  const { sentiment, score } = classifySentiment(headline, summary);
  const sentimentLabel = sentiment === 'bull' ? 'positive' : sentiment === 'bear' ? 'negative' : 'neutral';
  const tickerText = related.length ? related.join(', ') : 'the broader market';

  return {
    abstract: summary,
    marketImpact: `The headline reads as ${sentimentLabel} for ${tickerText}. Treat this as sentiment context and confirm it with price action, volume, and sector movement.`,
    keyPoints: [
      `Source: ${article.source || 'News feed'}.`,
      `Keyword sentiment score: ${score.toFixed(1)}/10.`,
      related.length ? `Related tickers: ${tickerText}.` : 'No specific tracked ticker was tagged by the source.',
    ],
    watchFor: `Watch whether ${tickerText} confirms the news with follow-through, unusual volume, or a break of recent support/resistance.`,
    sentiment,
    score,
    related,
  };
}

async function loadCachedAnalysis(key) {
  try {
    const result = await pool.query(
      'SELECT analysis FROM article_analysis_cache WHERE cache_key = $1',
      [key]
    );
    return result.rows[0]?.analysis || null;
  } catch {
    return null;
  }
}

async function saveCachedAnalysis(key, article, analysis, source) {
  try {
    await pool.query(
      `INSERT INTO article_analysis_cache (cache_key, article_url, headline, source, analysis, analysis_source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cache_key)
       DO UPDATE SET analysis = EXCLUDED.analysis, analysis_source = EXCLUDED.analysis_source, updated_at = CURRENT_TIMESTAMP`,
      [
        key,
        article.url || null,
        article.headline || article.title || null,
        article.source || null,
        analysis,
        source,
      ]
    );
  } catch {
    // Cache persistence should never block the user-facing analysis response.
  }
}

async function optionalAiAnalysis(article, fallback) {
  if (!env.ENABLE_AI_ANALYSIS || !env.AI_API_KEY) return null;

  const prompt = `You are a concise financial news analyst for Billy Bronco.
Return only JSON with keys: abstract, marketImpact, keyPoints, watchFor.
Use cautious language. Do not give financial advice.

Headline: ${article.headline || article.title || ''}
Source: ${article.source || 'News'}
Summary: ${article.summary || fallback.abstract}
Related tickers: ${article.related || 'General market'}`;

  const data = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.AI_API_KEY,
      'anthropic-version': env.ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const raw = (data.content || []).map((block) => block.text || '').join('');
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

exports.getQuote = async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase();
    const quote = await cached(cacheKey(['quote', symbol]), TTL.quote, () => (
      fetchJson(withToken(`/quote?symbol=${encodeURIComponent(symbol)}`))
    ));
    res.json({ quote, cache: 'server' });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load quote.' });
  }
};

exports.getCandles = async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase();
    const timeframe = String(req.query.timeframe || '1Y').toUpperCase();
    const dayMap = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = dayMap[timeframe] || 365;
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86400;
    const key = cacheKey(['candles', symbol, timeframe, Math.floor(to / 3600)]);
    const candles = await cached(key, TTL.candles, () => (
      fetchJson(withToken(`/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`))
    ));
    res.json({ candles, cache: 'server' });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load candles.' });
  }
};

exports.getMarketNews = async (req, res) => {
  try {
    const news = await cached(cacheKey(['news', 'general']), TTL.marketNews, () => (
      fetchJson(withToken('/news?category=general'))
    ));
    res.json({ news: Array.isArray(news) ? news : [], cache: 'server' });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load market news.' });
  }
};

exports.getCompanyNews = async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase();
    const to = new Date();
    const from = new Date(Date.now() - 7 * 86400000);
    const fmt = (date) => date.toISOString().slice(0, 10);
    const key = cacheKey(['company-news', symbol, fmt(to)]);
    const news = await cached(key, TTL.companyNews, () => (
      fetchJson(withToken(`/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}`))
    ));
    res.json({ news: Array.isArray(news) ? news.slice(0, 12) : [], cache: 'server' });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load company news.' });
  }
};

exports.analyzeNews = async (req, res) => {
  const article = req.body.article || {};
  const key = articleCacheKey(article);

  const cachedAnalysis = await loadCachedAnalysis(key);
  if (cachedAnalysis) {
    return res.json({ analysis: cachedAnalysis, source: 'cache' });
  }

  const fallback = deterministicAnalysis(article);
  let analysis = fallback;
  let source = 'deterministic';

  try {
    const aiAnalysis = await optionalAiAnalysis(article, fallback);
    if (aiAnalysis) {
      analysis = { ...fallback, ...aiAnalysis };
      source = 'ai';
    }
  } catch {
    analysis = fallback;
    source = 'deterministic';
  }

  await saveCachedAnalysis(key, article, analysis, source);
  return res.json({ analysis, source });
};

exports._private = {
  cache,
  classifySentiment,
  deterministicAnalysis,
  articleCacheKey,
};
