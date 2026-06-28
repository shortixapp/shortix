// Requires STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO env vars set in Netlify.
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: 'stripe_not_configured' }) };
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO, quantity: 1 }],
      success_url: `${process.env.URL || 'https://shortix.xyz'}/dashboard.html?upgraded=1`,
      cancel_url: `${process.env.URL || 'https://shortix.xyz'}/dashboard.html?upgrade=1`,
      customer_email: payload.email || undefined,
    });
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
