const pool = require('../db/pool');

async function getOrCreatePortfolio(userId) {
  const portfolioResult = await pool.query(
    'SELECT * FROM portfolios WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  if (portfolioResult.rows[0]) {
    return portfolioResult.rows[0];
  }

  const insertResult = await pool.query(
    'INSERT INTO portfolios (user_id, name, cash_balance) VALUES ($1, $2, $3) RETURNING *',
    [userId, 'My Portfolio', 50000]
  );

  return insertResult.rows[0];
}

exports.getPortfolio = async (req, res) => {
  try {
    const portfolio = await getOrCreatePortfolio(req.userId);
    const positionsResult = await pool.query(
      'SELECT * FROM positions WHERE portfolio_id = $1 ORDER BY created_at DESC',
      [portfolio.id]
    );

    res.json({ portfolio, positions: positionsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load portfolio.' });
  }
};

exports.addPosition = async (req, res) => {
  const { ticker, shares, avg_cost } = req.body;

  if (!ticker || shares === undefined || avg_cost === undefined) {
    return res.status(400).json({ error: 'Ticker, shares, and avg_cost are required.' });
  }

  try {
    const portfolio = await getOrCreatePortfolio(req.userId);

    await pool.query(
      `INSERT INTO positions (portfolio_id, ticker, shares, avg_cost)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (portfolio_id, ticker)
       DO UPDATE SET shares = EXCLUDED.shares, avg_cost = EXCLUDED.avg_cost`,
      [portfolio.id, ticker.toUpperCase(), shares, avg_cost]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save position.' });
  }
};

exports.deletePosition = async (req, res) => {
  try {
    const portfolioResult = await pool.query(
      'SELECT id FROM portfolios WHERE user_id = $1',
      [req.userId]
    );
    const portfolioId = portfolioResult.rows[0]?.id;
    if (!portfolioId) return res.status(404).json({ error: 'Portfolio not found.' });

    await pool.query(
      'DELETE FROM positions WHERE portfolio_id = $1 AND ticker = $2',
      [portfolioId, req.params.ticker.toUpperCase()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete position.' });
  }
};

exports.executeTrade = async (req, res) => {
  const { mode, ticker, shares, price } = req.body;
  const symbol = String(ticker || '').toUpperCase();
  const shareCount = Number(shares);
  const executionPrice = Number(price);

  if (!['buy', 'sell'].includes(mode)) {
    return res.status(400).json({ error: 'Trade mode must be buy or sell.' });
  }
  if (!symbol || !Number.isFinite(shareCount) || shareCount <= 0 || !Number.isFinite(executionPrice) || executionPrice <= 0) {
    return res.status(400).json({ error: 'Ticker, shares, and price are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let portfolioResult = await client.query(
      'SELECT * FROM portfolios WHERE user_id = $1 LIMIT 1 FOR UPDATE',
      [req.userId]
    );

    if (!portfolioResult.rows[0]) {
      portfolioResult = await client.query(
        'INSERT INTO portfolios (user_id, name, cash_balance) VALUES ($1, $2, $3) RETURNING *',
        [req.userId, 'My Portfolio', 50000]
      );
    }

    const portfolio = portfolioResult.rows[0];
    const total = shareCount * executionPrice;

    const positionResult = await client.query(
      'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 FOR UPDATE',
      [portfolio.id, symbol]
    );
    const existing = positionResult.rows[0];

    if (mode === 'buy') {
      if (Number(portfolio.cash_balance) < total) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient cash balance.' });
      }

      if (existing) {
        const existingShares = Number(existing.shares);
        const existingCost = Number(existing.avg_cost);
        const newShares = existingShares + shareCount;
        const newAvgCost = ((existingShares * existingCost) + total) / newShares;
        await client.query(
          'UPDATE positions SET shares = $1, avg_cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [newShares, newAvgCost, existing.id]
        );
      } else {
        await client.query(
          'INSERT INTO positions (portfolio_id, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)',
          [portfolio.id, symbol, shareCount, executionPrice]
        );
      }

      await client.query(
        'UPDATE portfolios SET cash_balance = cash_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [total, portfolio.id]
      );
    } else {
      if (!existing || Number(existing.shares) < shareCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Not enough shares to sell.' });
      }

      const remaining = Number(existing.shares) - shareCount;
      if (remaining <= 0.000001) {
        await client.query('DELETE FROM positions WHERE id = $1', [existing.id]);
      } else {
        await client.query(
          'UPDATE positions SET shares = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [remaining, existing.id]
        );
      }

      await client.query(
        'UPDATE portfolios SET cash_balance = cash_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [total, portfolio.id]
      );
    }

    await client.query(
      'INSERT INTO trades (portfolio_id, ticker, trade_type, shares, price, total) VALUES ($1, $2, $3, $4, $5, $6)',
      [portfolio.id, symbol, mode, shareCount, executionPrice, total]
    );

    const updatedPortfolio = await client.query('SELECT * FROM portfolios WHERE id = $1', [portfolio.id]);
    const positions = await client.query('SELECT * FROM positions WHERE portfolio_id = $1 ORDER BY created_at DESC', [portfolio.id]);

    await client.query('COMMIT');
    res.json({ portfolio: updatedPortfolio.rows[0], positions: positions.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to execute trade.' });
  } finally {
    client.release();
  }
};
