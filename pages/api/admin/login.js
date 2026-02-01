export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ ok: false, message: 'missing password' });
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return res.status(500).json({ ok: false, message: 'ADMIN_PASSWORD not set on server' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'invalid password' });
  return res.json({ ok: true });
}
