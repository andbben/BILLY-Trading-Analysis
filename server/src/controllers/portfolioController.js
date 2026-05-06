const pool = require('../db/pool');

const BANK_BALANCE = 1000000;
const BANK_ACCOUNTS = [
  {
    id: 'bank-checking',
    type: 'bank',
    label: 'Connected Checking - 4821',
    balance: BANK_BALANCE,
    accountNumber: '4821',
    institution: 'Billy Demo Bank',
  },
  {
    id: 'bank-savings',
    type: 'bank',
    label: 'Connected Savings - 9024',
    balance: BANK_BALANCE,
    accountNumber: '9024',
    institution: 'Billy Demo Bank',
  },
];

async function ensureTransfersTable(queryable = pool) {
  await queryable.query(`
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
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_cash_transfers_portfolio_id ON cash_transfers(portfolio_id)');
  await queryable.query("ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS occurrence VARCHAR(20) NOT NULL DEFAULT 'one_time'");
  await queryable.query('ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS recurring_option VARCHAR(30)');
  await queryable.query('ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS frequency VARCHAR(30)');
  await queryable.query('ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS start_date DATE');
  await queryable.query('ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS end_date DATE');
  await queryable.query('ALTER TABLE cash_transfers ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64)');
  await queryable.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id VARCHAR(80)');
  await queryable.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_label VARCHAR(255)');
  await queryable.query(`
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
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_billy_analyst_actions_portfolio_id ON billy_analyst_actions(portfolio_id)');
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS billy_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label VARCHAR(255) NOT NULL,
      account_number VARCHAR(24) NOT NULL,
      cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_billy_accounts_user_id ON billy_accounts(user_id)');
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS billy_account_positions (
      id SERIAL PRIMARY KEY,
      billy_account_id INTEGER NOT NULL REFERENCES billy_accounts(id) ON DELETE CASCADE,
      ticker VARCHAR(10) NOT NULL,
      shares DECIMAL(14, 4) NOT NULL,
      avg_cost DECIMAL(14, 4) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_ticker_per_billy_account UNIQUE(billy_account_id, ticker)
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_billy_account_positions_account_id ON billy_account_positions(billy_account_id)');
  await queryable.query(`
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
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_asset_transfers_portfolio_id ON asset_transfers(portfolio_id)');
  await queryable.query(`
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
    )
  `);
  await queryable.query('CREATE INDEX IF NOT EXISTS idx_connected_bank_accounts_user_id ON connected_bank_accounts(user_id)');
}

async function getOrCreatePortfolio(userId, queryable = pool, lock = false) {
  const portfolioResult = await queryable.query(
    `SELECT * FROM portfolios WHERE user_id = $1 LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId]
  );

  if (portfolioResult.rows[0]) {
    return portfolioResult.rows[0];
  }

  const insertResult = await queryable.query(
    'INSERT INTO portfolios (user_id, name, cash_balance) VALUES ($1, $2, $3) RETURNING *',
    [userId, 'My Portfolio', 50000]
  );

  return insertResult.rows[0];
}

function makeTransferId(prefix = 'TX') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeAccountNumber() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function makeBankDemoBalance() {
  return Math.floor(444444 + Math.random() * (7777777 - 444444 + 1));
}

function eftDailyLimitForPlan(plan) {
  if (plan === 'pro') return 250000;
  if (plan === 'plus') return 75000;
  return 10000;
}

function billyTransferLimitForPlan(plan) {
  if (plan === 'pro') return null;
  if (plan === 'plus') return 1000000;
  return 100000;
}

function normalizePosition(position) {
  return {
    id: position.id,
    ticker: position.ticker,
    shares: Number(position.shares || 0),
    avg_cost: Number(position.avg_cost || 0),
  };
}

async function getPrimaryPositions(portfolioId, queryable = pool) {
  const result = await queryable.query(
    'SELECT * FROM positions WHERE portfolio_id = $1 ORDER BY created_at DESC',
    [portfolioId]
  );
  return result.rows.map(normalizePosition);
}

async function ensureAuxBillyAccounts(userId, queryable = pool) {
  let result = await queryable.query(
    'SELECT * FROM billy_accounts WHERE user_id = $1 ORDER BY id',
    [userId]
  );

  if (result.rows.length) return result.rows;

  await queryable.query(
    'INSERT INTO billy_accounts (user_id, label, account_number, cash_balance) VALUES ($1, $2, $3, $4)',
    [userId, 'Billy Growth Account', '7822', 12500]
  );
  await queryable.query(
    'INSERT INTO billy_accounts (user_id, label, account_number, cash_balance) VALUES ($1, $2, $3, $4)',
    [userId, 'Billy Retirement Account', '4318', 8500]
  );

  result = await queryable.query(
    'SELECT * FROM billy_accounts WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return result.rows;
}

async function getAuxPositions(accountId, queryable = pool) {
  const result = await queryable.query(
    'SELECT * FROM billy_account_positions WHERE billy_account_id = $1 ORDER BY created_at DESC',
    [accountId]
  );
  return result.rows.map(normalizePosition);
}

async function getBillyAccounts(userId, portfolio, queryable = pool) {
  const primaryPositions = await getPrimaryPositions(portfolio.id, queryable);
  const auxAccounts = await ensureAuxBillyAccounts(userId, queryable);
  const mappedAuxAccounts = [];

  for (const account of auxAccounts) {
    mappedAuxAccounts.push({
      id: `billy:${account.id}`,
      rawId: account.id,
      source: 'billy_account',
      type: 'billy',
      label: account.label,
      accountNumber: account.account_number,
      balance: Number(account.cash_balance || 0),
      updatedAt: account.updated_at || account.created_at,
      positions: await getAuxPositions(account.id, queryable),
    });
  }

  return [
    {
      id: `portfolio:${portfolio.id}`,
      rawId: portfolio.id,
      source: 'portfolio',
      type: 'billy',
      label: portfolio.name || 'My Portfolio',
      accountNumber: String(portfolio.id).padStart(4, '0'),
      balance: Number(portfolio.cash_balance || 0),
      updatedAt: portfolio.updated_at || portfolio.created_at,
      positions: primaryPositions,
    },
    ...mappedAuxAccounts,
  ];
}

async function getBankAccounts(userId, queryable = pool) {
  await ensureTransfersTable(queryable);
  const result = await queryable.query(
    'SELECT * FROM connected_bank_accounts WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  const connected = result.rows.map((account) => ({
    id: `bank:${account.id}`,
    rawId: account.id,
    type: 'bank',
    label: account.account_name,
    institution: account.institution_name,
    accountType: account.account_type,
    accountNumber: account.account_last4,
    balance: Number(account.demo_balance || 0),
    balanceHidden: true,
    updatedAt: account.updated_at || account.created_at,
  }));

  return [
    ...connected,
    ...BANK_ACCOUNTS.map((account) => ({ ...account, balanceHidden: true })),
  ];
}

async function findAccount(accountId, userId, portfolio, queryable = pool, includeBanks = true) {
  const billyAccounts = await getBillyAccounts(userId, portfolio, queryable);
  const bankAccounts = includeBanks ? await getBankAccounts(userId, queryable) : [];
  const accounts = includeBanks ? [...bankAccounts, ...billyAccounts] : billyAccounts;
  return accounts.find((account) => account.id === accountId);
}

async function adjustCash(account, amount, queryable = pool) {
  if (account.type === 'bank') return;

  if (account.source === 'portfolio') {
    await queryable.query(
      'UPDATE portfolios SET cash_balance = cash_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, account.rawId]
    );
    return;
  }

  await queryable.query(
    'UPDATE billy_accounts SET cash_balance = cash_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [amount, account.rawId]
  );
}

async function getTransferWorkspace(userId, queryable = pool, portfolioOverride = null) {
  await ensureTransfersTable(queryable);
  const portfolio = portfolioOverride || await getOrCreatePortfolio(userId, queryable);
  const transfersResult = await queryable.query(
    'SELECT * FROM cash_transfers WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
    [portfolio.id]
  );
  const assetTransfersResult = await queryable.query(
    'SELECT * FROM asset_transfers WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
    [portfolio.id]
  );
  const tradesResult = await queryable.query(
    'SELECT * FROM trades WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
    [portfolio.id]
  );
  const billyAccounts = await getBillyAccounts(userId, portfolio, queryable);
  const bankAccounts = await getBankAccounts(userId, queryable);

  return {
    portfolio,
    accounts: [...bankAccounts, ...billyAccounts],
    billyAccounts,
    transfers: transfersResult.rows,
    assetTransfers: assetTransfersResult.rows,
    orders: tradesResult.rows,
  };
}

exports.getPortfolio = async (req, res) => {
  try {
    const portfolio = await getOrCreatePortfolio(req.userId);
    const positionsResult = await pool.query(
      'SELECT * FROM positions WHERE portfolio_id = $1 ORDER BY created_at DESC',
      [portfolio.id]
    );
    await ensureTransfersTable(pool);
    const transfersResult = await pool.query(
      'SELECT * FROM cash_transfers WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
      [portfolio.id]
    );
    const assetTransfersResult = await pool.query(
      'SELECT * FROM asset_transfers WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
      [portfolio.id]
    );
    const tradesResult = await pool.query(
      'SELECT * FROM trades WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT 25',
      [portfolio.id]
    );
    const billyAccounts = await getBillyAccounts(req.userId, portfolio);
    const bankAccounts = await getBankAccounts(req.userId);

    res.json({
      portfolio,
      positions: positionsResult.rows,
      accounts: [...bankAccounts, ...billyAccounts],
      billyAccounts,
      orders: tradesResult.rows,
      transfers: transfersResult.rows,
      assetTransfers: assetTransfersResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load portfolio.' });
  }
};

exports.getTransfers = async (req, res) => {
  try {
    const workspace = await getTransferWorkspace(req.userId);
    res.json(workspace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load transfer workspace.' });
  }
};

exports.createTransfer = async (req, res) => {
  const { fromAccount, toAccount, amount, memo } = req.body;
  const transferAmount = Number(amount);
  const occurrence = req.body.occurrence === 'recurring' ? 'recurring' : 'one_time';
  const recurringOption = req.body.recurringOption || null;
  const isEarningsRecurring = occurrence === 'recurring' && recurringOption === 'earnings';

  if (!fromAccount || !toAccount || !Number.isFinite(transferAmount) || (!isEarningsRecurring && transferAmount <= 0) || (isEarningsRecurring && transferAmount < 0)) {
    return res.status(400).json({ error: 'From account, to account, and a positive amount are required.' });
  }

  if (fromAccount === toAccount) {
    return res.status(400).json({ error: 'Choose two different accounts.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureTransfersTable(client);

    const portfolio = await getOrCreatePortfolio(req.userId, client, true);
    const from = await findAccount(fromAccount, req.userId, portfolio, client);
    const to = await findAccount(toAccount, req.userId, portfolio, client);

    if (!from || !to) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose valid connected bank or Billy accounts.' });
    }

    if (from.type !== 'billy' && to.type !== 'billy') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transfers must move cash to or from a Billy account.' });
    }

    const userResult = await client.query('SELECT plan FROM users WHERE id = $1', [req.userId]);
    const userPlan = userResult.rows[0]?.plan;

    if (from.type === 'bank' && to.type === 'billy') {
      const limit = eftDailyLimitForPlan(userResult.rows[0]?.plan);
      if (transferAmount > limit) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Your plan supports EFT deposits up to $${limit.toLocaleString()} per day.` });
      }
    }

    if (from.type === 'billy' && to.type === 'billy') {
      const limit = billyTransferLimitForPlan(userPlan);
      if (limit !== null && transferAmount > limit) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Your plan supports Billy to Billy transfers up to $${limit.toLocaleString()} per transaction.` });
      }
    }

    if (from.type === 'bank' && transferAmount > Number(from.balance || 0)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Connected bank funding limit exceeded for this demo.' });
    }

    if (from.type === 'billy' && Number(from.balance || 0) < transferAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient liquid cash in the Billy account.' });
    }

    const status = occurrence === 'recurring' ? 'active' : 'completed';

    if (occurrence === 'one_time') {
      if (from.type === 'billy') await adjustCash(from, -transferAmount, client);
      if (to.type === 'billy') await adjustCash(to, transferAmount, client);
    }

    await client.query(
      `INSERT INTO cash_transfers
       (portfolio_id, transfer_type, from_account, from_label, from_type, to_account, to_label, to_type, amount, memo,
        occurrence, recurring_option, frequency, start_date, end_date, transaction_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        portfolio.id,
        `${from.type}_to_${to.type}`,
        from.id,
        from.label,
        from.type,
        to.id,
        to.label,
        to.type,
        transferAmount,
        memo || null,
        occurrence,
        recurringOption,
        req.body.frequency || null,
        req.body.startDate || null,
        req.body.endDate || null,
        makeTransferId(occurrence === 'recurring' ? 'REC' : 'EFT'),
        status,
      ]
    );

    const updatedPortfolioResult = await client.query('SELECT * FROM portfolios WHERE id = $1', [portfolio.id]);
    const workspace = await getTransferWorkspace(req.userId, client, updatedPortfolioResult.rows[0]);

    await client.query('COMMIT');
    res.status(201).json(workspace);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Transfer failed.' });
  } finally {
    client.release();
  }
};

exports.createBillyAccount = async (req, res) => {
  const label = String(req.body.label || '').trim() || `Billy Account ${makeAccountNumber()}`;
  const openingCash = Number(req.body.openingCash || 0);

  if (!Number.isFinite(openingCash) || openingCash < 0) {
    return res.status(400).json({ error: 'Opening cash must be zero or greater.' });
  }

  try {
    await ensureTransfersTable(pool);
    await pool.query(
      'INSERT INTO billy_accounts (user_id, label, account_number, cash_balance) VALUES ($1, $2, $3, $4)',
      [req.userId, label, makeAccountNumber(), openingCash]
    );
    const portfolio = await getOrCreatePortfolio(req.userId);
    const workspace = await getTransferWorkspace(req.userId, pool, portfolio);
    res.status(201).json(workspace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to open Billy account.' });
  }
};

exports.connectBankAccount = async (req, res) => {
  const accountName = String(req.body.accountName || '').trim();
  const institutionName = String(req.body.institutionName || '').trim();
  const accountType = String(req.body.accountType || 'Checking').trim();
  const routingNumber = String(req.body.routingNumber || '').replace(/\D/g, '');
  const accountNumber = String(req.body.accountNumber || '').replace(/\D/g, '');
  const agreements = req.body.agreements || {};
  const accepted = ['ownership', 'fdic', 'ach', 'privacy'].every((key) => agreements[key] === true);

  if (!accountName || !institutionName || routingNumber.length < 4 || accountNumber.length < 4 || !accepted) {
    return res.status(400).json({ error: 'Complete bank details and accept all required agreements.' });
  }

  try {
    await ensureTransfersTable(pool);
    await pool.query(
      `INSERT INTO connected_bank_accounts
       (user_id, account_name, institution_name, account_type, routing_last4, account_last4, demo_balance, agreements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.userId,
        accountName,
        institutionName,
        accountType,
        routingNumber.slice(-4),
        accountNumber.slice(-4),
        makeBankDemoBalance(),
        JSON.stringify(agreements),
      ]
    );
    const portfolio = await getOrCreatePortfolio(req.userId);
    const workspace = await getTransferWorkspace(req.userId, pool, portfolio);
    res.status(201).json(workspace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect bank account.' });
  }
};

exports.renameAccount = async (req, res) => {
  const accountId = String(req.params.accountId || '');
  const label = String(req.body.label || '').trim();

  if (!accountId || !label) {
    return res.status(400).json({ error: 'Account and a new name are required.' });
  }

  try {
    await ensureTransfersTable(pool);
    const portfolio = await getOrCreatePortfolio(req.userId);

    if (accountId === `portfolio:${portfolio.id}`) {
      await pool.query(
        'UPDATE portfolios SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [label, portfolio.id, req.userId]
      );
    } else if (accountId.startsWith('billy:')) {
      await pool.query(
        'UPDATE billy_accounts SET label = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [label, Number(accountId.split(':')[1]), req.userId]
      );
    } else if (accountId.startsWith('bank:')) {
      await pool.query(
        'UPDATE connected_bank_accounts SET account_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [label, Number(accountId.split(':')[1]), req.userId]
      );
    } else {
      return res.status(400).json({ error: 'Static demo bank accounts cannot be renamed.' });
    }

    const updatedPortfolio = await getOrCreatePortfolio(req.userId);
    const workspace = await getTransferWorkspace(req.userId, pool, updatedPortfolio);
    res.json(workspace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename account.' });
  }
};

async function getAccountPosition(account, ticker, queryable = pool) {
  if (account.source === 'portfolio') {
    const result = await queryable.query(
      'SELECT * FROM positions WHERE portfolio_id = $1 AND ticker = $2 FOR UPDATE',
      [account.rawId, ticker]
    );
    return result.rows[0];
  }

  const result = await queryable.query(
    'SELECT * FROM billy_account_positions WHERE billy_account_id = $1 AND ticker = $2 FOR UPDATE',
    [account.rawId, ticker]
  );
  return result.rows[0];
}

async function removeShares(account, position, shares, queryable = pool) {
  const remaining = Number(position.shares) - shares;
  const table = account.source === 'portfolio' ? 'positions' : 'billy_account_positions';

  if (remaining <= 0.000001) {
    await queryable.query(`DELETE FROM ${table} WHERE id = $1`, [position.id]);
  } else {
    await queryable.query(
      `UPDATE ${table} SET shares = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [remaining, position.id]
    );
  }
}

async function addShares(account, ticker, shares, avgCost, queryable = pool) {
  if (account.source === 'portfolio') {
    const existing = await getAccountPosition(account, ticker, queryable);
    if (existing) {
      await queryable.query(
        'UPDATE positions SET shares = shares + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [shares, existing.id]
      );
    } else {
      await queryable.query(
        'INSERT INTO positions (portfolio_id, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)',
        [account.rawId, ticker, shares, avgCost]
      );
    }
    return;
  }

  const existing = await getAccountPosition(account, ticker, queryable);
  if (existing) {
    await queryable.query(
      'UPDATE billy_account_positions SET shares = shares + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [shares, existing.id]
    );
  } else {
    await queryable.query(
      'INSERT INTO billy_account_positions (billy_account_id, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)',
      [account.rawId, ticker, shares, avgCost]
    );
  }
}

exports.createShareTransfer = async (req, res) => {
  const { fromAccount, toAccount, ticker, shares } = req.body;
  const symbol = String(ticker || '').toUpperCase();
  const shareCount = Number(shares);

  if (!fromAccount || !toAccount || fromAccount === toAccount || !symbol || !Number.isFinite(shareCount) || shareCount <= 0) {
    return res.status(400).json({ error: 'Choose two Billy accounts, a stock, and a positive share amount.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureTransfersTable(client);
    const portfolio = await getOrCreatePortfolio(req.userId, client, true);
    const from = await findAccount(fromAccount, req.userId, portfolio, client, false);
    const to = await findAccount(toAccount, req.userId, portfolio, client, false);

    if (!from || !to) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Share transfers must stay between Billy accounts.' });
    }

    const position = await getAccountPosition(from, symbol, client);
    if (!position || Number(position.shares) < shareCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough shares available in the origin account.' });
    }

    await removeShares(from, position, shareCount, client);
    await addShares(to, symbol, shareCount, Number(position.avg_cost || 0), client);

    await client.query(
      `INSERT INTO asset_transfers
       (portfolio_id, from_account, from_label, to_account, to_label, ticker, shares, status, transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [portfolio.id, from.id, from.label, to.id, to.label, symbol, shareCount, 'completed', makeTransferId('SHR')]
    );

    const updatedPortfolioResult = await client.query('SELECT * FROM portfolios WHERE id = $1', [portfolio.id]);
    const workspace = await getTransferWorkspace(req.userId, client, updatedPortfolioResult.rows[0]);

    await client.query('COMMIT');
    res.status(201).json(workspace);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Share transfer failed.' });
  } finally {
    client.release();
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
  const { mode, ticker, shares, price, accountId } = req.body;
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

    await ensureTransfersTable(client);
    const portfolio = await getOrCreatePortfolio(req.userId, client, true);
    const account = await findAccount(accountId || `portfolio:${portfolio.id}`, req.userId, portfolio, client, false);
    if (!account) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a valid Billy account for this order.' });
    }

    const total = shareCount * executionPrice;
    const existing = await getAccountPosition(account, symbol, client);
    const positionTable = account.source === 'portfolio' ? 'positions' : 'billy_account_positions';
    const accountColumn = account.source === 'portfolio' ? 'portfolio_id' : 'billy_account_id';

    if (mode === 'buy') {
      if (Number(account.balance) < total) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient cash balance.' });
      }

      if (existing) {
        const existingShares = Number(existing.shares);
        const existingCost = Number(existing.avg_cost);
        const newShares = existingShares + shareCount;
        const newAvgCost = ((existingShares * existingCost) + total) / newShares;
        await client.query(
          `UPDATE ${positionTable} SET shares = $1, avg_cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [newShares, newAvgCost, existing.id]
        );
      } else {
        await client.query(
          `INSERT INTO ${positionTable} (${accountColumn}, ticker, shares, avg_cost) VALUES ($1, $2, $3, $4)`,
          [account.rawId, symbol, shareCount, executionPrice]
        );
      }

      await adjustCash(account, -total, client);
    } else {
      if (!existing || Number(existing.shares) < shareCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Not enough shares to sell.' });
      }

      const remaining = Number(existing.shares) - shareCount;
      if (remaining <= 0.000001) {
        await client.query(`DELETE FROM ${positionTable} WHERE id = $1`, [existing.id]);
      } else {
        await client.query(
          `UPDATE ${positionTable} SET shares = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [remaining, existing.id]
        );
      }

      await adjustCash(account, total, client);
    }

    await client.query(
      'INSERT INTO trades (portfolio_id, ticker, trade_type, shares, price, total, account_id, account_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [portfolio.id, symbol, mode, shareCount, executionPrice, total, account.id, account.label]
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

exports.executeBillyAnalyst = async (req, res) => {
  const {
    accountId,
    ticker,
    price,
    initialFund,
    maxInvestmentDollars,
    maxInvestmentPercent,
    maxLossDollars,
    maxLossPercent,
    reinvestGains,
    confidence,
    recommendation,
    rationale,
  } = req.body;
  const symbol = String(ticker || '').toUpperCase();
  const executionPrice = Number(price);
  const fund = Number(initialFund);
  const capDollars = Number(maxInvestmentDollars || 0);
  const capPercent = Number(maxInvestmentPercent || 0);
  const lossDollars = Number(maxLossDollars || 0);
  const lossPercent = Number(maxLossPercent || 0);

  if (!symbol || !accountId || !Number.isFinite(executionPrice) || executionPrice <= 0 || !Number.isFinite(fund) || fund <= 0) {
    return res.status(400).json({ error: 'Account, ticker, price, and initial fund are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureTransfersTable(client);

    const userResult = await client.query('SELECT plan FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows[0]?.plan !== 'pro') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Billy Analyst automated trading is available on the Pro plan.' });
    }

    const portfolio = await getOrCreatePortfolio(req.userId, client, true);
    const account = await findAccount(accountId, req.userId, portfolio, client, false);
    if (!account) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a valid Billy account for Billy Analyst.' });
    }

    const percentCapAmount = capPercent > 0 ? fund * (capPercent / 100) : fund;
    const maxDeployable = Math.min(fund, capDollars > 0 ? capDollars : fund, percentCapAmount, Number(account.balance || 0));
    const action = recommendation === 'sell' ? 'sell' : recommendation === 'hold' ? 'hold' : 'buy';
    let investedAmount = 0;
    let shares = 0;

    if (action === 'buy' && maxDeployable >= executionPrice) {
      shares = Math.floor((maxDeployable / executionPrice) * 10000) / 10000;
      investedAmount = shares * executionPrice;
      await addShares(account, symbol, shares, executionPrice, client);
      await adjustCash(account, -investedAmount, client);
      await client.query(
        'INSERT INTO trades (portfolio_id, ticker, trade_type, shares, price, total, account_id, account_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [portfolio.id, symbol, 'buy', shares, executionPrice, investedAmount, account.id, account.label]
      );
    } else if (action === 'sell') {
      const existing = await getAccountPosition(account, symbol, client);
      if (existing && Number(existing.shares) > 0) {
        shares = Number(existing.shares);
        investedAmount = shares * executionPrice;
        await removeShares(account, existing, shares, client);
        await adjustCash(account, investedAmount, client);
        await client.query(
          'INSERT INTO trades (portfolio_id, ticker, trade_type, shares, price, total, account_id, account_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [portfolio.id, symbol, 'sell', shares, executionPrice, investedAmount, account.id, account.label]
        );
      }
    }

    const status = action === 'hold' || investedAmount === 0 ? 'monitoring' : 'active';
    const result = await client.query(
      `INSERT INTO billy_analyst_actions
       (portfolio_id, account_id, account_label, ticker, action, initial_fund, invested_amount, shares,
        max_investment_dollars, max_investment_percent, max_loss_dollars, max_loss_percent, reinvest_gains,
        confidence, rationale, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        portfolio.id,
        account.id,
        account.label,
        symbol,
        action,
        fund,
        investedAmount,
        shares,
        capDollars || null,
        capPercent || null,
        lossDollars || null,
        lossPercent || null,
        Boolean(reinvestGains),
        Number(confidence || 0),
        String(rationale || '').slice(0, 1200),
        status,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ action: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Billy Analyst action failed.' });
  } finally {
    client.release();
  }
};
