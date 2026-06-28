const { getClient } = require('./_supabase');

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FREE_LIMIT = 5;

// Simple in-memory rate limiter: max 20 requests per IP per 60 seconds
const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (now - entry.start > RATE_WINDOW_MS) { rateMap.set(ip, { count: 1, start: now }); return false; }
  entry.count++;
  if (entry.count > RATE_MAX) return true;
  return false;
}

// Clean up old entries periodically (every 500 calls)
let gcCounter = 0;
function maybeGC() {
  if (++gcCounter < 500) return;
  gcCounter = 0;
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [key, val] of rateMap) {
    if (val.start < cutoff) rateMap.delete(key);
  }
}

function randomSlug(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function getClientId(event) {
  const xff = event.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return event.headers['client-ip'] || event.headers['x-nf-client-connection-ip'] || 'anonymous';
}

// Reject dangerous URL schemes — javascript:, data:, vbscript:, file:, etc.
const ALLOWED_SCHEMES = /^https?:\/\//i;
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file|blob):/i;

function isSafeUrl(url) {
  if (DANGEROUS_SCHEMES.test(url)) return false;
  if (!ALLOWED_SCHEMES.test(url)) return false;
  // Basic phishing guard: reject URLs that look like credential stuffing
  try {
    const u = new URL(url);
    // Reject URLs with embedded credentials (user:pass@host)
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  const clientId = getClientId(event);
  maybeGC();

  // Rate limit check
  if (isRateLimited(clientId)) {
    return {
      statusCode: 429,
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'rate_limited' }),
    };
  }

  const supabase = getClient();
  if (!supabase) {
    return { statusCode: 503, body: JSON.stringify({ error: 'no_database_configured' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { payload = {}; }
  const { url, slug } = payload;

  if (!url || typeof url !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'url_required' }) };
  }

  // Server-side URL safety validation
  if (!isSafeUrl(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_url' }) };
  }

  try { new URL(url); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_url' }) };
  }

  // Server-side free-tier limit enforcement (by IP until auth exists)
  const { count, error: countError } = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (countError) {
    return { statusCode: 500, body: JSON.stringify({ error: countError.message }) };
  }
  if (count >= FREE_LIMIT) {
    return { statusCode: 429, body: JSON.stringify({ error: 'limit_reached' }) };
  }

  let finalSlug = slug && /^[a-zA-Z0-9_-]{3,32}$/.test(slug) ? slug : null;
  if (!finalSlug) {
    for (let i = 0; i < 5; i++) {
      const candidate = randomSlug();
      const { data } = await supabase.from('links').select('id').eq('slug', candidate).maybeSingle();
      if (!data) { finalSlug = candidate; break; }
    }
  } else {
    const { data: existing } = await supabase.from('links').select('id').eq('slug', finalSlug).maybeSingle();
    if (existing) return { statusCode: 409, body: JSON.stringify({ error: 'slug_taken' }) };
  }
  if (!finalSlug) {
    return { statusCode: 500, body: JSON.stringify({ error: 'slug_generation_failed' }) };
  }

  const { data, error } = await supabase
    .from('links')
    .insert({ slug: finalSlug, url, clicks: 0, active: true, client_id: clientId })
    .select()
    .single();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify(data) };
};
