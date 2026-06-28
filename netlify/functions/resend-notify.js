// Requires RESEND_API_KEY and NOTIFY_SECRET env vars.
// NOTIFY_SECRET must be set to a long random string; callers must pass it
// as the X-Notify-Secret header so this endpoint is not open to the public.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  // Validate internal secret — prevents anyone who knows the URL from sending emails
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || event.headers['x-notify-secret'] !== secret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: 'resend_not_configured' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  const { to, subject, html } = payload;

  if (!to || !subject || !html) {
    return { statusCode: 400, body: JSON.stringify({ error: 'to_subject_html_required' }) };
  }

  // Validate "to" is a plausible email address
  if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_to_address' }) };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Shortix <hello@shortix.xyz>',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { statusCode: 500, body: JSON.stringify({ error: err }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
