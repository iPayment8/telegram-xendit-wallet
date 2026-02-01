const db = require('./db');
const crypto = require('./crypto');

async function getConfig() {
  const keys = [
    'TELEGRAM_BOT_TOKEN',
    'XENDIT_API_KEY',
    'XENDIT_CALLBACK_TOKEN',
    'VERCEL_URL',
    'XENDIT_MODE'
  ];

  const config = {};
  // first, load from environment
  for (const k of keys) {
    if (process.env[k]) config[k] = process.env[k];
  }

  // then, load from DB settings (decrypted) if not present in env
  const dbSettings = await db.getAllSettings();
  for (const k of keys) {
    if (!config[k] && dbSettings[k]) {
      try {
        config[k] = crypto.decrypt(dbSettings[k]);
      } catch (e) {
        config[k] = dbSettings[k];
      }
    }
  }

  return config;
}

module.exports = { getConfig };
