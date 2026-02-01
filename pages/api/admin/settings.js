import dbModule from '../../../lib/db';
import cryptoModule from '../../../lib/crypto';
const db = dbModule;
const { encrypt, decrypt } = cryptoModule;

export default async function handler(req, res) {
  // simple auth: require header x-admin-password matching ADMIN_PASSWORD
  const adminPass = req.headers['x-admin-password'];
  if (!adminPass || adminPass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const dbSettings = await db.getAllSettings();
      const out = {};
      for (const k of Object.keys(dbSettings)) {
        out[k] = decrypt(dbSettings[k]);
      }
      return res.json({ ok: true, settings: out });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      // payload expected to be { TELEGRAM_BOT_TOKEN: "...", XENDIT_API_KEY: "...", ... }
      for (const key of Object.keys(payload)) {
        const raw = payload[key];
        const stored = encrypt(raw);
        await db.setSetting(key, stored);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).end();
}
