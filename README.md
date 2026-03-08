# Checkout Champ API Proxy

Proxy server for Checkout Champ API. Deploy on Render (or VPS) to get a fixed outbound IP for IP whitelisting.

## Local Setup

1. Copy env file:
   ```bash
   cp .env.example .env
   ```

2. Fill in `.env`:
   - `PROXY_SECRET` – Generate with: `openssl rand -hex 32`
   - `CHECKOUT_CHAMP_LOGIN_ID` – API username from Checkout Champ
   - `CHECKOUT_CHAMP_PASSWORD` – API password from Checkout Champ

3. Install and run:
   ```bash
   npm install
   npm start
   ```

4. Test:
   ```bash
   curl -X POST http://localhost:3001/proxy \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_PROXY_SECRET" \
     -d '{"endpoint":"/customers/query/","params":{"emailAddress":"test@example.com","exactEmailMatch":"1","startDate":"01/01/2023","endDate":"12/31/2025"}}'
   ```

---

## Deploy on Render

### 1. Push to GitHub

Push the `checkout-champ-proxy` folder to a repo (or as part of your main repo).

**Option A – Separate repo:** Create a new repo with only the proxy files.

**Option B – Monorepo:** Render can deploy from a subfolder (see below).

### 2. Create Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name:** `checkout-champ-proxy`
   - **Root Directory:** `checkout-champ-proxy` (if in a monorepo, else leave blank)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free or Starter

### 3. Environment Variables

In Render → Your service → **Environment**:

| Key | Value |
|-----|-------|
| `PROXY_SECRET` | Your generated secret (e.g. from `openssl rand -hex 32`) |
| `CHECKOUT_CHAMP_LOGIN_ID` | Checkout Champ API username |
| `CHECKOUT_CHAMP_PASSWORD` | Checkout Champ API password |

### 4. Get Outbound IPs

1. Deploy the service
2. Go to **Settings** → **Outbound** tab
3. Copy the IP ranges (or use QuotaGuard for dedicated IPs)

### 5. Whitelist in Checkout Champ

Add the Render outbound IP(s) to the API user's IP Whitelist in Checkout Champ (one per line).

---

## LifeTrove Integration

Add to your Next.js `.env.local`:

```
CHECKOUT_CHAMP_PROXY_URL=https://your-proxy.onrender.com
PROXY_SECRET=<same value as proxy's PROXY_SECRET>
```

Then call the proxy from your API routes instead of Checkout Champ directly.
