/* Shortix — Supabase Auth (magic link)
   Loaded on dashboard.html and stats.html.
   - Checks for active session; redirects to index.html#login if none.
   - Exposes window.ShortixAuth for other scripts.
   - Handles the magic-link callback (token_hash in URL).             */
(function () {
  // Supabase anon key & URL come from env — injected at build time via
  // a <script> block in each HTML file that uses auth. Both are safe to
  // expose in the browser (they are the anon/public key, not service key).
  // See: https://supabase.com/docs/guides/api/api-keys
  function getSupabase() {
    if (!window.__SUPABASE_URL || !window.__SUPABASE_ANON_KEY) return null;
    return supabase.createClient(window.__SUPABASE_URL, window.__SUPABASE_ANON_KEY);
  }

  let _client = null;
  let _session = null;

  function client() {
    if (!_client) _client = getSupabase();
    return _client;
  }

  async function getSession() {
    if (_session) return _session;
    const sb = client();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    _session = data?.session || null;
    return _session;
  }

  async function signInWithEmail(email) {
    const sb = client();
    if (!sb) return { error: 'supabase_not_configured' };
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/dashboard.html` },
    });
    return { error: error?.message || null };
  }

  async function signOut() {
    const sb = client();
    if (sb) await sb.auth.signOut();
    _session = null;
    window.location.href = '/';
  }

  async function requireAuth() {
    const sb = client();
    if (!sb) {
      // Supabase not configured — allow access (dev/demo mode)
      return null;
    }

    // Handle magic-link callback (token_hash or access_token in URL)
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const tokenHash = query.get('token_hash') || hash.get('access_token');

    if (tokenHash) {
      // Exchange the token for a session
      await sb.auth.exchangeCodeForSession(tokenHash).catch(() => {});
      // Clean the URL
      history.replaceState({}, '', location.pathname);
    }

    const session = await getSession();
    if (!session) {
      // Not logged in — redirect to landing with login modal trigger
      window.location.href = '/?login=1';
      return null;
    }
    return session;
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
  }

  window.ShortixAuth = {
    client,
    getSession,
    getCurrentUser,
    signInWithEmail,
    signOut,
    requireAuth,
  };
})();
