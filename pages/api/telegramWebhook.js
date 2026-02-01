const axios = require('axios');
const db = require('../../lib/db');
const { getConfig } = require('../../lib/config');

function parseArgs(text) {
  const parts = text.trim().split(/\s+/);
  return parts.slice(1);
}

async function sendMessage(botToken, chat_id, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id, text, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Failed to send telegram message', err?.response?.data || err.message);
  }
}

module.exports = async function handler(req, res) {
  try {
    const update = req.body;
    if (!update) return res.status(400).send('no update');

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return res.status(200).send('ignored');

    const config = await getConfig();
    const TELEGRAM_TOKEN = config.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_TOKEN) {
      console.warn('Telegram token missing in config');
      return res.status(500).send('bot not configured');
    }

    const telegram_id = msg.from.id;
    const username = msg.from.username || `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
    const text = msg.text.trim();

    let user = await db.findUserByTelegramId(telegram_id);
    if (!user) {
      user = await db.createUser({ telegram_id, username });
    }

    if (text.startsWith('/start')) {
      await sendMessage(TELEGRAM_TOKEN, telegram_id, `Welcome ${username}!\nYour wallet balance: ${Number(user.balance).toFixed(2)}\nCommands:\n/deposit <amount> <email> - create a payment invoice\n/balance - check balance\n/withdraw-request <amount> <bank_code> <account_number> <account_name> - request withdrawal`);
      return res.status(200).send('ok');
    }

    if (text.startsWith('/balance')) {
      user = await db.findUserByTelegramId(telegram_id);
      await sendMessage(TELEGRAM_TOKEN, telegram_id, `Your balance is: ${Number(user.balance).toFixed(2)}`);
      return res.status(200).send('ok');
    }

    if (text.startsWith('/deposit')) {
      const args = parseArgs(text);
      const amount = Number(args[0]);
      const payer_email = args[1];

      if (!amount || amount <= 0 || !payer_email) {
        await sendMessage(TELEGRAM_TOKEN, telegram_id, 'Usage: /deposit <amount> <email>\nExample: /deposit 100000 buyer@example.com');
        return res.status(200).send('ok');
      }

      const external_id = `deposit_${Date.now()}_${telegram_id}`;
      const payload = {
        external_id,
        payer_email,
        description: `Deposit to telegram wallet ${telegram_id}`,
        amount: Math.round(amount),
        callback_url: `${config.VERCEL_URL ? `https://${config.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL}/api/xenditWebhook`
      };

      const auth = { username: config.XENDIT_API_KEY || process.env.XENDIT_API_KEY || '', password: '' };
      const invoiceResp = await axios.post('https://api.xendit.co/v2/invoices', payload, { auth });
      const invoice = invoiceResp.data;

      await db.createTransaction({
        user_id: user.id,
        external_id,
        type: 'deposit',
        amount: payload.amount,
        status: 'pending',
        metadata: { invoice_id: invoice.id, invoice_url: invoice.invoice_url, xendit: invoice }
      });

      const invoiceUrl = invoice.invoice_url || invoice.payment_method_url || invoice.redirect_url || '(invoice url not returned)';
      await sendMessage(TELEGRAM_TOKEN, telegram_id, `Invoice created: ${invoiceUrl}\nOpen and complete the payment. After payment, your wallet will be updated automatically.`);
      return res.status(200).send('ok');
    }

    if (text.startsWith('/withdraw-request')) {
      const args = parseArgs(text);
      const amount = Number(args[0]);
      const bank_code = args[1];
      const account_number = args[2];
      const account_name = args.slice(3).join(' ');

      if (!amount || amount <= 0 || !bank_code || !account_number || !account_name) {
        await sendMessage(TELEGRAM_TOKEN, telegram_id, 'Usage: /withdraw-request <amount> <bank_code> <account_number> <account_name>\nExample: /withdraw-request 50000 BCA 1234567890 "John Doe"');
        return res.status(200).send('ok');
      }

      user = await db.findUserByTelegramId(telegram_id);
      if (Number(user.balance) < amount) {
        await sendMessage(TELEGRAM_TOKEN, telegram_id, `Insufficient balance. Your balance: ${Number(user.balance).toFixed(2)}`);
        return res.status(200).send('ok');
      }

      const external_id = `withdraw_req_${Date.now()}_${telegram_id}`;
      await db.createTransaction({
        user_id: user.id,
        external_id,
        type: 'withdraw_request',
        amount,
        status: 'requested',
        metadata: { bank_code, account_number, account_name }
      });

      await db.updateUserBalance(user.id, Number(user.balance)

