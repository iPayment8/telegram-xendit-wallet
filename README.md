# Telegram Wallet + Xendit Invoices (Next.js, Vercel deployment)

This repo provides:
- A Telegram bot webhook to manage user wallets and create Xendit invoices (deposits).
- A Xendit webhook to mark invoices PAID and credit user wallets.
- An Admin UI (/admin) to store secrets (Telegram token, Xendit API key, callback token, Vercel URL) in the Postgres DB (encrypted if APP_ENCRYPTION_KEY is set).
- Postgres persistence (DATABASE_URL). Works well with Supabase.

Important pre-deploy env vars (set these in Vercel before first deploy):
- DATABASE_URL — required (Postgres connection string)
- ADMIN_PASSWORD — required (simple password to access /admin)
- APP_ENCRYPTION_KEY — strongly recommended (32+ random characters). Settings stored encrypted at rest if set.

Optional (can also be stored via Admin UI after you set DATABASE_URL & ADMIN_PASSWORD):
- TELEGRAM_BOT_TOKEN
- XENDIT_API_KEY
- XENDIT_CALLBACK_TOKEN
- VERCEL_URL (your-deploy.vercel.app)

Quick deploy:
1. Push this repo to GitHub (you are already using the GitHub UI).
2. In Vercel project settings, set at minimum: DATABASE_URL, ADMIN_PASSWORD, APP_ENCRYPTION_KEY.
3. Deploy.
4. Visit https://<YOUR_VERCEL_URL>/admin, log in with ADMIN_PASSWORD and save TELEGRAM_BOT_TOKEN, XENDIT_API_KEY, XENDIT_CALLBACK_TOKEN, VERCEL_URL.
5. Set Telegram webhook:
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/telegramWebhook"
6. Set Xendit webhook in Xendit Dashboard to:
   https://<YOUR_VERCEL_URL>/api/xenditWebhook
   and set the Callback Token in Xendit Dashboard to match XENDIT_CALLBACK_TOKEN.

Security note:
- This Admin UI uses a simple password header authentication. Replace with proper auth for production.
- Keep APP_ENCRYPTION_KEY and XENDIT_API_KEY secret.
- Test in Xendit test mode first if desired.
