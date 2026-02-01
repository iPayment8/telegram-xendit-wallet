const crypto = require('crypto');

const ALGO = 'aes-256-cbc';

function getKey() {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k) return null;
  // Ensure 32-byte key
  return crypto.createHash('sha256').update(k).digest();
}

function encrypt(text) {
  const key = getKey();
  if (!key) return text; // fallback: no encryption key set
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  // store iv + encrypted
  return iv.toString('base64') + ':' + encrypted;
}

function decrypt(data) {
  const key = getKey();
  if (!key) return data; // fallback
  if (!data) return data;
  const parts = String(data).split(':');
  if (parts.length !== 2) return data;
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    let out = decipher.update(encrypted, 'base64', 'utf8');
    out += decipher.final('utf8');
    return out;
  } catch (err) {
    // if decryption fails, return original
    return data;
  }
}

module.exports = { encrypt, decrypt };
