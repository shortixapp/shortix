const { getClient } = require('./_supabase');

exports.handler = async (event) => {
  const supabase = getClient();
  if (!supabase) {
    return { statusCode: 503, body: JSON.stringify({ error: 'no_database_configured' }) };
  }

  // Path looks like /.netlify/functions/links or /.netlify/functions/links/:id
  const parts = event.path.split('/').filter(Boolean);
  const id = parts[parts.length - 1] !== 'links' ? parts[parts.length - 1] : null;

  // TODO: once auth is wired up, filter all queries below by the
  // authenticated user's id so each account only sees its own links.

  if (event.httpMethod === 'GET' && !id) {
    const { data, error } = await supabase.from('links').select('*').order('created_at', { ascending: false });
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'GET' && id) {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .or(`id.eq.${id},slug.eq.${id}`)
      .maybeSingle();
    if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };
    return { statusCode: 200, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'DELETE' && id) {
    const { error } = await supabase.from('links').delete().eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
};
