process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-for-backend-tests';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.FINNHUB_API_KEY = 'test-finnhub-key';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const pool = require('../src/db/pool');
const app = require('../src/app');

const db = {
  users: [],
  portfolios: [],
  positions: [],
  alerts: [],
  trades: [],
  cashTransfers: [],
  billyAccounts: [],
  billyAccountPositions: [],
  assetTransfers: [],
  connectedBankAccounts: [],
  billyAnalystActions: [],
};

const ids = {
  user: 1,
  portfolio: 1,
  position: 1,
  alert: 1,
  trade: 1,
  cashTransfer: 1,
  billyAccount: 1,
  billyAccountPosition: 1,
  assetTransfer: 1,
  connectedBankAccount: 1,
  billyAnalystAction: 1,
};

function resetDb() {
  db.users = [];
  db.portfolios = [];
  db.positions = [];
  db.alerts = [];
  db.trades = [];
  db.cashTransfers = [];
  db.billyAccounts = [];
  db.billyAccountPositions = [];
  db.assetTransfers = [];
  db.connectedBankAccounts = [];
  db.billyAnalystActions = [];
  ids.user = 1;
  ids.portfolio = 1;
  ids.position = 1;
  ids.alert = 1;
  ids.trade = 1;
  ids.cashTransfer = 1;
  ids.billyAccount = 1;
  ids.billyAccountPosition = 1;
  ids.assetTransfer = 1;
  ids.connectedBankAccount = 1;
  ids.billyAnalystAction = 1;
}

function rows(rowsValue = []) {
  return Promise.resolve({ rows: rowsValue });
}

function runQuery(sql, params = []) {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized.startsWith('begin') || normalized.startsWith('commit') || normalized.startsWith('rollback')) {
    return rows();
  }

  if (normalized.startsWith('create table if not exists') || normalized.startsWith('create index if not exists') || normalized.startsWith('alter table cash_transfers') || normalized.startsWith('alter table trades')) {
    return rows();
  }

  if (normalized.includes('select id from users where email')) {
    const user = db.users.find((item) => item.email === params[0]);
    return rows(user ? [{ id: user.id }] : []);
  }

  if (normalized.includes('select * from users where email')) {
    const user = db.users.find((item) => item.email === params[0]);
    return rows(user ? [user] : []);
  }

  if (normalized.includes('insert into users')) {
    const user = {
      id: ids.user++,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      plan: 'free',
      created_at: new Date(),
      updated_at: new Date(),
    };
    db.users.push(user);
    return rows([{ id: user.id, name: user.name, email: user.email }]);
  }

  if (normalized.includes('select plan from users where id')) {
    const user = db.users.find((item) => item.id === params[0]);
    return rows(user ? [{ plan: user.plan }] : []);
  }

  if (normalized.includes('insert into portfolios')) {
    const portfolio = {
      id: ids.portfolio++,
      user_id: params[0],
      name: params[1],
      cash_balance: Number(params[2] ?? 50000),
      created_at: new Date(),
      updated_at: new Date(),
    };
    db.portfolios.push(portfolio);
    return rows(normalized.includes('returning') ? [portfolio] : []);
  }

  if (normalized.includes('select * from portfolios where user_id')) {
    const portfolio = db.portfolios.find((item) => item.user_id === params[0]);
    return rows(portfolio ? [portfolio] : []);
  }

  if (normalized.includes('select * from portfolios where id')) {
    const portfolio = db.portfolios.find((item) => item.id === params[0]);
    return rows(portfolio ? [portfolio] : []);
  }

  if (normalized.includes('select * from positions where portfolio_id = $1 and ticker = $2')) {
    const position = db.positions.find((item) => item.portfolio_id === params[0] && item.ticker === params[1]);
    return rows(position ? [position] : []);
  }

  if (normalized.includes('select * from positions where portfolio_id')) {
    return rows(db.positions.filter((item) => item.portfolio_id === params[0]));
  }

  if (normalized.includes('insert into positions')) {
    const position = {
      id: ids.position++,
      portfolio_id: params[0],
      ticker: params[1],
      shares: Number(params[2]),
      avg_cost: Number(params[3]),
      created_at: new Date(),
      updated_at: new Date(),
    };
    db.positions.push(position);
    return rows();
  }

  if (normalized.includes('update positions set shares = $1, avg_cost = $2')) {
    const position = db.positions.find((item) => item.id === params[2]);
    position.shares = Number(params[0]);
    position.avg_cost = Number(params[1]);
    position.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('update positions set shares = $1')) {
    const position = db.positions.find((item) => item.id === params[1]);
    position.shares = Number(params[0]);
    position.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('update positions set shares = shares + $1')) {
    const position = db.positions.find((item) => item.id === params[1]);
    position.shares = Number(position.shares) + Number(params[0]);
    position.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('delete from positions where id')) {
    db.positions = db.positions.filter((item) => item.id !== params[0]);
    return rows();
  }

  if (normalized.includes('update portfolios set cash_balance = cash_balance - $1')) {
    const portfolio = db.portfolios.find((item) => item.id === params[1]);
    portfolio.cash_balance = Number(portfolio.cash_balance) - Number(params[0]);
    return rows();
  }

  if (normalized.includes('update portfolios set cash_balance = cash_balance + $1')) {
    const portfolio = db.portfolios.find((item) => item.id === params[1]);
    portfolio.cash_balance = Number(portfolio.cash_balance) + Number(params[0]);
    return rows();
  }

  if (normalized.includes('insert into trades')) {
    db.trades.push({
      id: ids.trade++,
      portfolio_id: params[0],
      ticker: params[1],
      trade_type: params[2],
      shares: Number(params[3]),
      price: Number(params[4]),
      total: Number(params[5]),
      account_id: params[6],
      account_label: params[7],
      created_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('select * from trades where portfolio_id')) {
    return rows(db.trades.filter((item) => item.portfolio_id === params[0]));
  }

  if (normalized.includes('select * from connected_bank_accounts where user_id')) {
    return rows(db.connectedBankAccounts.filter((item) => item.user_id === params[0]));
  }

  if (normalized.includes('insert into connected_bank_accounts')) {
    db.connectedBankAccounts.push({
      id: ids.connectedBankAccount++,
      user_id: params[0],
      account_name: params[1],
      institution_name: params[2],
      account_type: params[3],
      routing_last4: params[4],
      account_last4: params[5],
      demo_balance: Number(params[6]),
      agreements: params[7],
      created_at: new Date(),
      updated_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('select * from billy_accounts where user_id')) {
    return rows(db.billyAccounts.filter((item) => item.user_id === params[0]));
  }

  if (normalized.includes('insert into billy_accounts')) {
    db.billyAccounts.push({
      id: ids.billyAccount++,
      user_id: params[0],
      label: params[1],
      account_number: params[2],
      cash_balance: Number(params[3] || 0),
      created_at: new Date(),
      updated_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('select * from billy_account_positions where billy_account_id = $1 and ticker = $2')) {
    const position = db.billyAccountPositions.find((item) => item.billy_account_id === params[0] && item.ticker === params[1]);
    return rows(position ? [position] : []);
  }

  if (normalized.includes('select * from billy_account_positions where billy_account_id')) {
    return rows(db.billyAccountPositions.filter((item) => item.billy_account_id === params[0]));
  }

  if (normalized.includes('insert into billy_account_positions')) {
    db.billyAccountPositions.push({
      id: ids.billyAccountPosition++,
      billy_account_id: params[0],
      ticker: params[1],
      shares: Number(params[2]),
      avg_cost: Number(params[3]),
      created_at: new Date(),
      updated_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('update billy_account_positions set shares = shares + $1')) {
    const position = db.billyAccountPositions.find((item) => item.id === params[1]);
    position.shares = Number(position.shares) + Number(params[0]);
    position.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('update billy_account_positions set shares = $1')) {
    const position = db.billyAccountPositions.find((item) => item.id === params[1]);
    position.shares = Number(params[0]);
    position.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('delete from billy_account_positions where id')) {
    db.billyAccountPositions = db.billyAccountPositions.filter((item) => item.id !== params[0]);
    return rows();
  }

  if (normalized.includes('update billy_accounts set cash_balance = cash_balance + $1')) {
    const account = db.billyAccounts.find((item) => item.id === params[1]);
    account.cash_balance = Number(account.cash_balance) + Number(params[0]);
    account.updated_at = new Date();
    return rows();
  }

  if (normalized.includes('select * from cash_transfers where portfolio_id')) {
    return rows(db.cashTransfers.filter((item) => item.portfolio_id === params[0]).sort((a, b) => b.id - a.id));
  }

  if (normalized.includes('insert into cash_transfers')) {
    db.cashTransfers.push({
      id: ids.cashTransfer++,
      portfolio_id: params[0],
      transfer_type: params[1],
      from_account: params[2],
      from_label: params[3],
      from_type: params[4],
      to_account: params[5],
      to_label: params[6],
      to_type: params[7],
      amount: Number(params[8]),
      memo: params[9],
      occurrence: params[10],
      recurring_option: params[11],
      frequency: params[12],
      start_date: params[13],
      end_date: params[14],
      transaction_id: params[15],
      status: params[16],
      created_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('select * from asset_transfers where portfolio_id')) {
    return rows(db.assetTransfers.filter((item) => item.portfolio_id === params[0]).sort((a, b) => b.id - a.id));
  }

  if (normalized.includes('insert into asset_transfers')) {
    db.assetTransfers.push({
      id: ids.assetTransfer++,
      portfolio_id: params[0],
      from_account: params[1],
      from_label: params[2],
      to_account: params[3],
      to_label: params[4],
      ticker: params[5],
      shares: Number(params[6]),
      status: params[7],
      transaction_id: params[8],
      created_at: new Date(),
    });
    return rows();
  }

  if (normalized.includes('insert into billy_analyst_actions')) {
    const action = {
      id: ids.billyAnalystAction++,
      portfolio_id: params[0],
      account_id: params[1],
      account_label: params[2],
      ticker: params[3],
      action: params[4],
      initial_fund: Number(params[5]),
      invested_amount: Number(params[6]),
      shares: Number(params[7]),
      max_investment_dollars: params[8],
      max_investment_percent: params[9],
      max_loss_dollars: params[10],
      max_loss_percent: params[11],
      reinvest_gains: params[12],
      confidence: params[13],
      rationale: params[14],
      status: params[15],
      created_at: new Date(),
    };
    db.billyAnalystActions.push(action);
    return rows([action]);
  }

  if (normalized.includes('select * from alerts where user_id')) {
    return rows(db.alerts.filter((item) => item.user_id === params[0]));
  }

  if (normalized.includes('insert into alerts')) {
    const alert = {
      id: ids.alert++,
      user_id: params[0],
      ticker: params[1],
      alert_kind: params[2],
      alert_type: params[3],
      condition: params[4],
      price_target: params[5],
      is_active: true,
      status: 'active',
    };
    db.alerts.push(alert);
    return rows([alert]);
  }

  if (normalized.includes('select * from alerts where id = $1 and user_id = $2')) {
    const alert = db.alerts.find((item) => item.id === Number(params[0]) && item.user_id === params[1]);
    return rows(alert ? [alert] : []);
  }

  if (normalized.includes('update alerts set is_active = not is_active')) {
    const alert = db.alerts.find((item) => item.id === Number(params[0]));
    alert.is_active = !alert.is_active;
    alert.status = alert.is_active ? 'active' : 'inactive';
    return rows([alert]);
  }

  if (normalized.includes('delete from alerts where id')) {
    db.alerts = db.alerts.filter((item) => item.id !== Number(params[0]));
    return rows();
  }

  if (normalized.includes('select id, name, email, plan')) {
    const user = db.users.find((item) => item.id === params[0]);
    return rows(user ? [{ id: user.id, name: user.name, email: user.email, plan: user.plan }] : []);
  }

  if (normalized.includes('update users set plan')) {
    const user = db.users.find((item) => item.id === params[1]);
    user.plan = params[0];
    return rows([{ id: user.id, name: user.name, email: user.email, plan: user.plan }]);
  }

  throw new Error(`Unhandled test query: ${sql}`);
}

pool.query = runQuery;
pool.connect = async () => ({
  query: runQuery,
  release() {},
});

let server;
let baseUrl;

test.before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
});

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: raw ? JSON.parse(raw) : {},
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function registerUser(email = 'test@example.com') {
  const res = await request('POST', '/api/auth/register', {
    name: 'Test User',
    email,
    password: 'password123',
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  return res.body.token;
}

test('auth register and login flow returns tokens', async () => {
  resetDb();
  await registerUser();

  const login = await request('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123',
  });

  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  assert.equal(login.body.user.email, 'test@example.com');
});

test('portfolio trade flow buys and sells shares', async () => {
  resetDb();
  const token = await registerUser('trader@example.com');

  const buy = await request('POST', '/api/portfolio/trades', {
    mode: 'buy',
    ticker: 'AAPL',
    shares: 2,
    price: 100,
  }, token);

  assert.equal(buy.status, 200);
  assert.equal(Number(buy.body.portfolio.cash_balance), 49800);
  assert.equal(Number(buy.body.positions[0].shares), 2);

  const sell = await request('POST', '/api/portfolio/trades', {
    mode: 'sell',
    ticker: 'AAPL',
    shares: 1,
    price: 110,
  }, token);

  assert.equal(sell.status, 200);
  assert.equal(Number(sell.body.portfolio.cash_balance), 49910);
  assert.equal(Number(sell.body.positions[0].shares), 1);
  assert.equal(db.trades.length, 2);
});

test('cash transfers update Billy liquid cash only', async () => {
  resetDb();
  const token = await registerUser('transfers@example.com');

  const workspace = await request('GET', '/api/portfolio/transfers', null, token);
  assert.equal(workspace.status, 200);
  assert.equal(Number(workspace.body.portfolio.cash_balance), 50000);

  const billyAccount = workspace.body.accounts.find((account) => account.type === 'billy');
  const bankAccount = workspace.body.accounts.find((account) => account.type === 'bank');
  assert.ok(billyAccount);
  assert.ok(bankAccount);

  const deposit = await request('POST', '/api/portfolio/transfers', {
    fromAccount: bankAccount.id,
    toAccount: billyAccount.id,
    amount: 2500,
    memo: 'fund account',
  }, token);

  assert.equal(deposit.status, 201);
  assert.equal(Number(deposit.body.portfolio.cash_balance), 52500);
  assert.equal(deposit.body.transfers[0].transfer_type, 'bank_to_billy');

  const withdrawal = await request('POST', '/api/portfolio/transfers', {
    fromAccount: billyAccount.id,
    toAccount: bankAccount.id,
    amount: 1200,
  }, token);

  assert.equal(withdrawal.status, 201);
  assert.equal(Number(withdrawal.body.portfolio.cash_balance), 51300);
  assert.equal(withdrawal.body.transfers[0].transfer_type, 'billy_to_bank');
});

test('cash transfer rejects unavailable Billy cash', async () => {
  resetDb();
  const token = await registerUser('transfer-risk@example.com');

  const workspace = await request('GET', '/api/portfolio/transfers', null, token);
  const billyAccount = workspace.body.accounts.find((account) => account.type === 'billy');
  const bankAccount = workspace.body.accounts.find((account) => account.type === 'bank');

  const withdrawal = await request('POST', '/api/portfolio/transfers', {
    fromAccount: billyAccount.id,
    toAccount: bankAccount.id,
    amount: 75000,
  }, token);

  assert.equal(withdrawal.status, 400);
  assert.equal(withdrawal.body.error, 'Insufficient liquid cash in the Billy account.');
  assert.equal(db.cashTransfers.length, 0);
});

test('share transfers move eligible positions between Billy accounts', async () => {
  resetDb();
  const token = await registerUser('shares-transfer@example.com');

  const buy = await request('POST', '/api/portfolio/trades', {
    mode: 'buy',
    ticker: 'AAPL',
    shares: 5,
    price: 100,
  }, token);
  assert.equal(buy.status, 200);

  const workspace = await request('GET', '/api/portfolio/transfers', null, token);
  const primary = workspace.body.billyAccounts.find((account) => account.source === 'portfolio');
  const destination = workspace.body.billyAccounts.find((account) => account.source === 'billy_account');

  const moved = await request('POST', '/api/portfolio/transfers/shares', {
    fromAccount: primary.id,
    toAccount: destination.id,
    ticker: 'AAPL',
    shares: 2,
  }, token);

  assert.equal(moved.status, 201);
  assert.equal(Number(db.positions[0].shares), 3);
  assert.equal(Number(db.billyAccountPositions[0].shares), 2);
  assert.equal(moved.body.assetTransfers[0].ticker, 'AAPL');
});

test('alerts can be created, toggled, and deleted', async () => {
  resetDb();
  const token = await registerUser('alerts@example.com');

  const created = await request('POST', '/api/alerts', {
    ticker: 'NVDA',
    alert_kind: 'price',
    alert_type: 'above',
    condition: 'above',
    price_target: 900,
  }, token);

  assert.equal(created.status, 201);
  assert.equal(created.body.alert.ticker, 'NVDA');

  const toggled = await request('PATCH', `/api/alerts/${created.body.alert.id}/toggle`, null, token);
  assert.equal(toggled.status, 200);
  assert.equal(toggled.body.alert.is_active, false);

  const deleted = await request('DELETE', `/api/alerts/${created.body.alert.id}`, null, token);
  assert.equal(deleted.status, 200);
  assert.equal(db.alerts.length, 0);
});

test('selected plan persists on the user record', async () => {
  resetDb();
  const token = await registerUser('plans@example.com');

  const updated = await request('PATCH', '/api/users/plan', { plan: 'pro' }, token);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.plan, 'pro');
});
