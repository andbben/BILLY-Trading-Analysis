const pool = require('../db/pool');

exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, plan, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, plan',
      [name, req.userId]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

exports.updatePlan = async (req, res) => {
  const { plan } = req.body;
  const allowedPlans = ['free', 'plus', 'pro'];

  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: 'Plan must be free, plus, or pro.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, plan',
      [plan, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update plan.' });
  }
};
