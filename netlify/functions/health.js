exports.handler = async () => {
  const hasDb = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;
  if (!hasDb) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, reason: 'no_database_configured' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
