const { getClient } = require('./_supabase');

exports.handler = async (event) => {
  const supabase = getClient();
  const slug = (event.path || '').split('/').filter(Boolean).pop();

  if (!supabase) {
    return { statusCode: 503, body: 'Shortix backend is not configured yet.' };
  }
  if (!slug) {
    return { statusCode: 302, headers: { Location: '/' } };
  }

  const { data: link, error } = await supabase
    .from('links')
    .select('id, url, active')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !link || link.active === false) {
    return { statusCode: 302, headers: { Location: '/404.html' } };
  }

  // Collect analytics metadata from Netlify headers
  const country = event.headers['x-country'] || event.headers['x-nf-geo-country'] || 'Unknown';
  const ua = event.headers['user-agent'] || '';
  const device = /Mobi|Android/i.test(ua) ? 'Mobile' : /Tablet|iPad/i.test(ua) ? 'Tablet' : 'Desktop';

  // Detect browser
  let browser = 'Other';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  // Atomic increment + analytics insert — fire-and-forget, never block redirect
  Promise.all([
    supabase.rpc('increment_clicks', { link_id: link.id }),
    supabase.from('clicks').insert({ link_id: link.id, country, device, browser, user_agent: ua }),
  ]).catch(() => {});

  return { statusCode: 302, headers: { Location: link.url } };
};
