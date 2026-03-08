/**
 * Checkout Champ API Proxy
 *
 * Forwards requests from LifeTrove (Next.js) to Checkout Champ API.
 * Deploy on Render/VPS with a fixed IP and whitelist that IP in Checkout Champ.
 */

const express = require('express');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3001;
const CHECKOUT_CHAMP_BASE = 'https://api.checkoutchamp.com';
const PROXY_SECRET = process.env.PROXY_SECRET || '1234567890';
const CHECKOUT_LOGIN = process.env.CHECKOUT_CHAMP_LOGIN_ID || '1234567890';
const CHECKOUT_PASSWORD = process.env.CHECKOUT_CHAMP_PASSWORD || '1234567890';

// Validate required env vars
if (!PROXY_SECRET || !CHECKOUT_LOGIN || !CHECKOUT_PASSWORD) {
  console.error('Missing required env vars: PROXY_SECRET, CHECKOUT_CHAMP_LOGIN_ID, CHECKOUT_CHAMP_PASSWORD');
  process.exit(1);
}

// Auth middleware: only allow requests with valid secret
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${PROXY_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'checkout-champ-proxy' });
});

/**
 * POST /proxy
 * Body: { endpoint: string, params: object }
 * Forwards to https://api.checkoutchamp.com{endpoint}?loginId=...&password=...&params...
 */
app.post('/proxy', async (req, res) => {
  try {
    const { endpoint, params = {} } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'endpoint (string) required in body' });
    }

    const url = new URL(endpoint.startsWith('/') ? endpoint : `/${endpoint}`, CHECKOUT_CHAMP_BASE);
    const searchParams = new URLSearchParams({
      loginId: CHECKOUT_LOGIN,
      password: CHECKOUT_PASSWORD,
      ...params,
    });
    url.search = searchParams.toString();

    const response = await fetch(url.toString());
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Checkout Champ proxy listening on port ${PORT}`);
});
