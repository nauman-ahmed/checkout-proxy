/**
 * Checkout Champ API Proxy
 *
 * Forwards requests from the LifeTrove server (Next.js API routes) to Checkout Champ API.
 * Deploy on Render/VPS with a fixed IP and whitelist that IP in Checkout Champ.
 *
 * Server-to-server only: every /proxy request must carry PROXY_SECRET, and only
 * the Checkout Champ endpoints LifeTrove uses are forwarded.
 */

require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');
const express = require('express');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

const PORT = process.env.PORT || 3001;
const CHECKOUT_CHAMP_BASE = 'https://api.checkoutchamp.com';
const CHECKOUT_LOGIN = process.env.CHECKOUT_CHAMP_LOGIN_ID;
const CHECKOUT_PASSWORD = process.env.CHECKOUT_CHAMP_PASSWORD;
const PROXY_SECRET = process.env.PROXY_SECRET;

// Validate required env vars
if (!CHECKOUT_LOGIN || !CHECKOUT_PASSWORD || !PROXY_SECRET) {
  console.error('Missing required env vars: CHECKOUT_CHAMP_LOGIN_ID, CHECKOUT_CHAMP_PASSWORD, PROXY_SECRET');
  process.exit(1);
}

// Checkout Champ endpoints LifeTrove calls. Anything else is rejected.
const ALLOWED_ENDPOINTS = new Set([
  '/customer/query/',
  '/members/query/',
  '/members/login/',
  '/order/query/',
  '/order/import/',
]);

// Params the caller may not override.
const RESERVED_PARAMS = new Set(['loginId', 'password']);

function secretMatches(provided) {
  if (typeof provided !== 'string' || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(PROXY_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireProxySecret(req, res, next) {
  const header = req.get('x-proxy-secret');
  const auth = req.get('authorization');
  const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (secretMatches(header) || secretMatches(bearer)) {
    return next();
  }
  return res.status(401).json({ result: 'ERROR', message: 'Unauthorized' });
}

// Public route (no proxy auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'checkout-champ-proxy' });
});

/**
 * POST /proxy
 * Headers: x-proxy-secret: <PROXY_SECRET>
 * Body: { endpoint: string, params: object }
 * Forwards to https://api.checkoutchamp.com{endpoint}?loginId=...&password=...&params...
 */
app.post('/proxy', requireProxySecret, async (req, res) => {
  try {
    const { endpoint, params = {} } = req.body || {};

    if (typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.has(endpoint)) {
      return res.status(400).json({ result: 'ERROR', message: 'Endpoint not allowed' });
    }

    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return res.status(400).json({ result: 'ERROR', message: 'params must be an object' });
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (RESERVED_PARAMS.has(key)) continue;
      if (value === undefined || value === null) continue;
      if (typeof value === 'object') {
        return res.status(400).json({ result: 'ERROR', message: `Invalid value for ${key}` });
      }
      searchParams.set(key, String(value));
    }
    searchParams.set('loginId', CHECKOUT_LOGIN);
    searchParams.set('password', CHECKOUT_PASSWORD);

    // endpoint is an exact allow-listed path, so the host is always Checkout Champ.
    const url = `${CHECKOUT_CHAMP_BASE}${endpoint}?${searchParams.toString()}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { result: 'ERROR', message: 'Unexpected response from Checkout Champ' };
    }

    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ result: 'ERROR', message: 'Could not reach Checkout Champ' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Checkout Champ proxy listening on port ${PORT}`);
});
