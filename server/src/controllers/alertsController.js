const pool = require('../db/pool');

exports.getAlerts = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load alerts.' });
  }
};

exports.createAlert = async (req, res) => {
  const ticker = String(req.body.ticker || '').toUpperCase();
  const alertKind = req.body.alert_kind || req.body.type || 'price';
  const alertType = req.body.alert_type || 'above';
  const condition = req.body.condition || alertType;
  const priceTarget = req.body.price_target;

  if (!ticker || !alertKind || !condition) {
    return res.status(400).json({ error: 'Ticker, alert kind, and condition are required.' });
  }

  if (!['price', 'technical', 'news'].includes(alertKind)) {
    return res.status(400).json({ error: 'Alert kind must be price, technical, or news.' });
  }

  if (alertKind === 'price' && (priceTarget === undefined || priceTarget === null || priceTarget === '')) {
    return res.status(400).json({ error: 'Price alerts require price_target.' });
  }

  if (alertKind === 'price' && !['above', 'below'].includes(alertType)) {
    return res.status(400).json({ error: 'Price alert type must be above or below.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO alerts (user_id, ticker, alert_kind, alert_type, condition, price_target, is_active, status)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'active')
       RETURNING *`,
      [req.userId, ticker, alertKind, alertType, condition, alertKind === 'price' ? priceTarget : null]
    );

    res.status(201).json({ alert: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create alert.' });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await pool.query(
      'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (alert.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    await pool.query('DELETE FROM alerts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete alert.' });
  }
};

exports.toggleAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await pool.query(
      'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (alert.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    const result = await pool.query(
      `UPDATE alerts
       SET is_active = NOT is_active,
           status = CASE WHEN is_active THEN 'inactive' ELSE 'active' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ alert: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle alert.' });
  }
};
