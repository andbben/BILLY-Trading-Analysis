import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { ALL_FETCH_SYMBOLS, DEMO_NEWS, FALLBACK_PRICES, STOCKS_BASE } from '../data/market';
import { genSyntheticCandles } from '../utils/indicators';

const CANDLE_TTL = 24 * 60 * 60 * 1000;

function makeFallbackQuote(symbol) {
  const base = FALLBACK_PRICES[symbol] || 100;
  const wobble = ((symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1)) % 9) - 4;
  const dp = wobble / 2;
  const d = (base * dp) / 100;
  return {
    c: base,
    d,
    dp,
    h: base * 1.012,
    l: base * 0.988,
    o: base - d / 2,
    pc: base - d,
    isFallback: true,
  };
}

function localMarketStatus() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const isOpen = day >= 1 && day <= 5 && mins >= 570 && mins < 960;
  return { isOpen, label: isOpen ? 'Market Open' : 'Market Closed' };
}

function getCachedCandles(key) {
  try {
    const raw = sessionStorage.getItem(`bb_candles_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CANDLE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedCandles(key, data) {
  try {
    sessionStorage.setItem(`bb_candles_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Session storage is an optimization only.
  }
}

export function useMarketData() {
  const [quotes, setQuotes] = useState({});
  const [news, setNews] = useState(DEMO_NEWS);
  const [mktStatus, setMktStatus] = useState(localMarketStatus());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchQuote = useCallback(async (symbol) => {
    try {
      const data = await api.getQuote(symbol);
      return data.quote?.c ? data.quote : makeFallbackQuote(symbol);
    } catch {
      return makeFallbackQuote(symbol);
    }
  }, []);

  const refreshQuotes = useCallback(async () => {
    const entries = await Promise.all(
      ALL_FETCH_SYMBOLS.map(async (symbol) => [symbol, await fetchQuote(symbol)]),
    );
    if (!mountedRef.current) return;
    setQuotes(Object.fromEntries(entries));
    setMktStatus(localMarketStatus());
    setLastUpdate(new Date());
    setLoading(false);
  }, [fetchQuote]);

  const refreshNews = useCallback(async () => {
    try {
      const data = await api.getMarketNews();
      if (Array.isArray(data.news) && data.news.length) {
        setNews(data.news.slice(0, 24));
      }
    } catch {
      setNews(DEMO_NEWS);
    }
  }, []);

  const fetchStockCandles = useCallback(async (symbol, timeframe = '1Y') => {
    const cacheKey = `${symbol}_${timeframe}`;
    const cached = getCachedCandles(cacheKey);
    if (cached) return cached;

    try {
      const data = await api.getCandles(symbol, timeframe);
      const candles = data.candles;
      if (candles?.c?.length > 1) {
        setCachedCandles(cacheKey, candles);
        return candles;
      }
    } catch {
      // Fall through to deterministic synthetic data.
    }

    const dayMap = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = dayMap[timeframe] || 365;
    const synthetic = {
      c: genSyntheticCandles(symbol, FALLBACK_PRICES[symbol] || quotes[symbol]?.c || 100, days),
      t: Array.from({ length: days }, (_, index) => Math.floor((Date.now() - (days - index - 1) * 86400000) / 1000)),
      s: 'fallback',
    };
    setCachedCandles(cacheKey, synthetic);
    return synthetic;
  }, [quotes]);

  const fetchCompanyNews = useCallback(async (symbol) => {
    try {
      const data = await api.getCompanyNews(symbol);
      if (Array.isArray(data.news) && data.news.length) {
        return data.news.slice(0, 8);
      }
    } catch {
      // Use local fallback below.
    }

    const related = news.filter((item) => (item.related || '').toUpperCase().includes(symbol));
    if (related.length) return related;

    const info = STOCKS_BASE[symbol];
    return [
      {
        source: 'Billy Bronco',
        headline: `${symbol} remains in focus as investors watch ${info?.sector || 'market'} momentum`,
        summary: 'No recent company-specific feed item was available, so this fallback highlights the stock for monitoring.',
        related: symbol,
        datetime: Math.floor(Date.now() / 1000) - 3600,
        url: 'https://finnhub.io',
      },
    ];
  }, [news]);

  useEffect(() => {
    mountedRef.current = true;
    refreshQuotes().catch(() => {
      setError('Market data is using local fallback estimates.');
      setLoading(false);
    });
    refreshNews();

    const quoteInterval = window.setInterval(refreshQuotes, localMarketStatus().isOpen ? 15000 : 90000);
    const newsInterval = window.setInterval(refreshNews, 5 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(quoteInterval);
      window.clearInterval(newsInterval);
    };
  }, [refreshNews, refreshQuotes]);

  return {
    quotes,
    news,
    mktStatus,
    loading,
    lastUpdate,
    error,
    wsStatus: 'polling',
    fetchStockCandles,
    fetchCompanyNews,
  };
}
