// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars.
// Configure this URL as the webhook endpoint in the Stripe dashboard:
// https://<your-site>.netlify.app/.netlify/functions/stripe-webhook
const Stripe = require('stripe');
const { getClient } = require('./_supabase');

exports.handler = async (event) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 503, body: 'stripe_not_configured' };
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature error: ${err.message}` };
  }

  const supabase = getClient();

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const email = session.customer_email || session.customer_details?.email;
    if (supabase && email) {
      // TODO: map to your actual users table once auth is wired up.
      await supabase.from('users').update({ plan: 'pro' }).eq('email', email);
    }
    // TODO: send a "Welcome to Pro" email via Resend here (see resend-notify.js).
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object;
    if (supabase && sub.customer) {
      await supabase.from('users').update({ plan: 'free' }).eq('stripe_customer_id', sub.customer);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
