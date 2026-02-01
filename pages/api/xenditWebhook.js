const axios = require('axios');
const db = require('../../lib/db');
const { getConfig } = require('../../lib/config');

module.exports = async function handler(req, res) {
  try {
    const body = req.body || {};
    const config = await getConfig();
    const callbackToken = config.XENDIT_CALLBACK_TOKEN || process.env.XENDIT_CALLBACK_TOKEN;
    if (callbackToken) {
      const headerToken = req.headers['x-callback-token'] || req.headers['X-Callback-Token'];
      if (!headerToken || headerToken !== callbackToken) {
        console.warn('Invalid callback token', headerToken);
        return res.status(403).send('forbidden');
      }
    }

    if (body.type === 'invoice.updated' || body.type === 'invoice' || body.type === undefined) {
      const invoice = body.data || body.data?.invoice || body.invoice || body;
      const status = (invoice.status || invoice.state || '').toUpperCase();
      const external_id = invoice.external_id;
      const amount = Number(invoice.amount);

      if (!external_id) {
        console.warn('No external_id in invoice webhook');
        return res.status(200).send('ok');
      }

      if (status === 'PAID') {
        const tx = await db.findTransactionByExternalId(external_id);
        if (!tx) {
          console.warn('transaction not found for', external_id);
          return res.status(200).send('ok');
        }
        if (tx.status === 'paid') return res.status(200).send('already processed');

        await db.markTransactionPaid(tx.id, invoice);

        const user = await db.findUserById(tx.user_id);
        if (user && user.telegram_id) {
          const TELEGRAM_TOKEN = config.TELEGRAM_BOT_TOKEN;
          if (TELEGRAM_TOKEN) {
            try {
              await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: user.telegram_id,
                text: `Payment received ✅\nInvoice ${external_id} has been paid.\nAmount added: ${Number(tx.amount).toFixed(2)}\nNew balance: ${Number(user.balance).toFixed(2)}`
              });
            } catch (err) {
              console.error('Failed to notify user', err?.response?.data || err.message);
            }
          }
        }
      }

      return res.status(200).send('ok');
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('xendit webhook error', err?.response?.data || err.message);
    return res.status(500).send('error');
  }
};
