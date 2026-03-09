/**
 * Checkout Champ API Proxy
 *
 * Forwards requests from LifeTrove (Next.js) to Checkout Champ API.
 * Deploy on Render/VPS with a fixed IP and whitelist that IP in Checkout Champ.
 */

require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CHECKOUT_CHAMP_BASE = 'https://api.checkoutchamp.com';
const CHECKOUT_LOGIN = process.env.CHECKOUT_CHAMP_LOGIN_ID;
const CHECKOUT_PASSWORD = process.env.CHECKOUT_CHAMP_PASSWORD;

// Validate required env vars
if (!CHECKOUT_LOGIN || !CHECKOUT_PASSWORD) {
  console.error('Missing required env vars: CHECKOUT_CHAMP_LOGIN_ID, CHECKOUT_CHAMP_PASSWORD');
  process.exit(1);
}

// Minimal OpenAPI spec for the proxy, used by Swagger UI at /docs
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Checkout Champ Proxy',
    version: '1.0.0',
    description:
      'Proxy for Checkout Champ API. Use POST /proxy with { endpoint, params } to forward requests.',
  },
  paths: {
    '/proxy': {
      post: {
        summary: 'Forward a request to Checkout Champ via proxy',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  endpoint: {
                    type: 'string',
                    description: 'Checkout Champ API path (e.g. /customer/query/ or /clubs/query/)',
                    example: '/customer/query/',
                  },
                  params: {
                    type: 'object',
                    description: 'Querystring params forwarded to Checkout Champ',
                    example: {
                      emailAddress: 'customer@example.com',
                      exactEmailMatch: '1',
                      startDate: '01/01/2020',
                      endDate: '12/31/2025',
                      resultsPerPage: '25',
                    },
                  },
                },
                required: ['endpoint'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Checkout Champ response wrapped by the proxy',
          },
          401: {
            description: 'Bad request',
          },
        },
      },
    },
  },
};

// Public routes (no proxy auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'checkout-champ-proxy' });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
