# Shortix

A professional URL shortener with an analytics dashboard, QR codes, dark/light
mode, RTL support, and 6 languages (English, Arabic, French, Spanish,
Chinese, Portuguese).

## What's included

- **Frontend** — plain HTML/CSS/JS (no build step), in `/`, `/css`, `/js`, `/locales`
- **Backend** — Netlify Functions in `netlify/functions/` talking to Supabase
- **Database** — Supabase (Postgres, free tier) — schema in `supabase-schema.sql`
- **Payments** — Stripe Checkout (subscription) — `create-checkout-session.js` + `stripe-webhook.js`
- **Email** — Resend transactional email — `resend-notify.js`
- **PWA** — `manifest.json` + `sw.js`, installable to home screen
- **Icons/favicon** — generated from your uploaded logo

The site works immediately with **no backend configured**: the shorten form
and dashboard fall back to a local, per-browser demo store (`localStorage`),
capped at 5 links, so you can click through the whole product before wiring
up real infrastructure. Once you add the environment variables below, it
automatically switches to the real database — no code changes needed.

## 1. Deploy to Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build settings are already in `netlify.toml` — no changes needed.
4. Deploy. Your site is live at `<your-site>.netlify.app`.

## 2. Connect your domain (Spaceship)

In Netlify → **Domain settings → Add a domain** → enter `shortix.xyz`.
Netlify will give you DNS records (usually an A record + CNAME for `www`).
In Spaceship's DNS panel, replace the existing records with the ones Netlify
shows you. Propagation usually takes under an hour.

## 3. Set up the database (Supabase — free tier)

1. Create a project at supabase.com.
2. Open the **SQL Editor** and run the contents of `supabase-schema.sql`.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → Netlify env var `SUPABASE_URL`
   - `service_role` secret key → Netlify env var `SUPABASE_SERVICE_KEY`

⚠️ The service role key bypasses Row Level Security — it must only ever be
used server-side (in Netlify Functions), never sent to the browser. The
front-end never talks to Supabase directly.

In Netlify: **Site settings → Environment variables**, add both.

## 4. Set up payments (Stripe)

1. In the Stripe dashboard, create a recurring **Price** for the Pro plan.
2. Add Netlify env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID_PRO`
3. After first deploy, go to Stripe → **Developers → Webhooks**, add an
   endpoint pointing to
   `https://shortix.xyz/.netlify/functions/stripe-webhook`, subscribe to
   `checkout.session.completed` and `customer.subscription.deleted`, then
   copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The "Upgrade to Pro" buttons currently link to the dashboard with an
`?upgrade=1` flag — wire them to call `create-checkout-session.js` and
redirect to the returned `session.url` once you're ready to go live with
billing.

## 5. Set up email (Resend)

1. Create an API key at resend.com and verify your sending domain
   (`shortix.xyz`).
2. Add Netlify env var `RESEND_API_KEY`.
3. `resend-notify.js` is ready to call for welcome emails, click-limit
   warnings, etc. — call it from the webhook or from a scheduled function.

## 6. What's stubbed vs. production-ready

**Ready to use as-is:**
- Landing page, dashboard UI, stats UI, language switching, theme switching, PWA install, icon set, redirect function, click logging, link CRUD.

**Needs your decision before launch:**
- **Auth** — there's currently no login/signup flow; the free tier works
  anonymously via `localStorage`, and the API functions are open. Before
  charging for Pro, add an auth provider (Supabase Auth is the natural fit
  since the database is already there) and filter every query in
  `links.js` / `shorten.js` by the logged-in user's id (marked with `TODO`
  comments in those files).
- **Plan enforcement** — the 5-link free cap is currently enforced
  client-side for the demo store only; add the same check server-side in
  `shorten.js` once users/plans exist in the database.
- **Real device/browser/country analytics** — `stats.js` currently shows
  representative demo numbers so the dashboard looks complete immediately.
  Swap in a query against the `clicks` table (already being populated by
  `redirect.js`) to show real numbers once you have traffic.

## Suggestions to consider next

- Add Supabase Auth (magic link or Google) for real accounts.
- Add a `link_expiration` column for self-destructing links.
- Add bulk CSV import for Pro users with many links to migrate.
- Add UTM-builder helper in the create-link modal.
- Add browser-extension or bookmarklet for one-click shortening.

## Local development

This is a static site with serverless functions — install the Netlify CLI
(`npm i -g netlify-cli`), run `npm install`, then `netlify dev` from this
folder to run both the static site and the functions locally with hot
reload.
