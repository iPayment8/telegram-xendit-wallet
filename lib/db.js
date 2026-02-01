const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If your provider requires SSL tweaks, set them here.
  // ssl: { rejectUnauthorized: false }
});

let initialized = false;
async function init() {
  if (initialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        balance NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        external_id TEXT UNIQUE,
        type TEXT,
        amount NUMERIC,
        status TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    initialized = true;
  } finally {
    client.release();
  }
}

// Settings
async function setSetting(key, value) {
  await init();
  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING *`,
    [key, value]
  );
  return rows[0];
}

async function getSetting(key) {
  await init();
  const { rows } = await pool.query('SELECT * FROM app_settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

async function getAllSettings() {
  await init();
  const { rows } = await pool.query('SELECT key, value FROM app_settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// Existing user/transaction helpers
async function findUserByTelegramId(telegram_id) {
  await init();
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegram_id]);
  return rows[0];
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

async function createUser({ telegram_id, username }) {
  await init();
  const { rows } = await pool.query(
    'INSERT INTO users (telegram_id, username) VALUES ($1, $2) ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username RETURNING *',
    [telegram_id, username]
  );
  return rows[0];
}

async function updateUserBalance(userId, newBalance) {
  const { rows } = await pool.query('UPDATE users SET balance = $1 WHERE id = $2 RETURNING *', [newBalance, userId]);
  return rows[0];
}

async function createTransaction({ user_id, external_id, type, amount, status = 'pending', metadata = {} }) {
  await init();
  const { rows } = await pool.query(
    'INSERT INTO transactions (user_id, external_id, type, amount, status, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [user_id, external_id, type, amount, status, metadata]
  );
  return rows[0];
}

async function findTransactionByExternalId(external_id) {
  const { rows } = await pool.query('SELECT * FROM transactions WHERE external_id = $1', [external_id]);
  return rows[0];
}

async function markTransactionPaid(txId, invoiceData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [txId]);
    const tx = txRes.rows[0];
    if (!tx) throw new Error('tx not found');

    if (tx.status === 'paid') {
      await client.query('COMMIT');
      return;
    }

    await client.query('UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3', ['paid', JSON.stringify({ xendit_invoice: invoiceData }), txId]);

    const userRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [tx.user_id]);
    const user = userRes.rows[0];
    const newBalance = Number(user.balance || 0) + Number(tx.amount || 0);
    await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user.id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  init,
  setSetting,
  getSetting,
  getAllSettings,
  findUserByTelegramId,
  createUser,
  createTransaction,
  findTransactionByExternalId,
  markTransactionPaid,
  findUserById,
  updateUserBalance
};
