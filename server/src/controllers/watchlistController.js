const pool = require('../db/pool');

exports.getWatchlist = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ watchlist: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load watchlist.' });
  }
};

exports.addToWatchlist = async (req, res) => {
  const { ticker } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker is required.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND ticker = $2',
      [req.userId, ticker.toUpperCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This ticker is already in your watchlist.' });
    }

    await pool.query(
      'INSERT INTO watchlist (user_id, ticker) VALUES ($1, $2)',
      [req.userId, ticker.toUpperCase()]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to watchlist.' });
  }
};

exports.removeFromWatchlist = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND ticker = $2',
      [req.userId, req.params.ticker.toUpperCase()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove from watchlist.' });
  }
};
