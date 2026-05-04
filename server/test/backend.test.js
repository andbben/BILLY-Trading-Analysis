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
};

const ids = {
  user: 1,
  portfolio: 1,
  position: 1,
  alert: 1,
  trade: 1,
};

function resetDb() {
  db.users = [];
  db.portfolios = [];
  db.positions = [];
  db.alerts = [];
  db.trades = [];
  ids.user = 1;
  ids.portfolio = 1;
  ids.position = 1;
  ids.alert = 1;
  ids.trade = 1;
}

function rows(rowsValue = []) {
  return Promise.resolve({ rows: rowsValue });
}

function runQuery(sql, params = []) {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized.startsWith('begin') || normalized.startsWith('commit') || normalized.startsWith('rollback')) {
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
    });
    return rows();
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
