/* Shortix — data layer
   Tries the live API (Netlify Functions -> Supabase) first.
   Falls back to a localStorage-backed demo store so the front-end
   is fully clickable even before a database is connected. */
(function () {
  const API_BASE = '/.netlify/functions';
  const LS_KEY = 'shortix_links_v1';
  const FREE_LIMIT = 5;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  }
  function writeLocal(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

  function randomSlug(len = 6) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // Cache the health-check result for 60 seconds only — avoids locking the
  // app into "offline" mode for the entire session after a transient failure.
  let _apiCache = null; // { ok: bool, ts: timestamp }
  const API_CACHE_TTL = 60_000;

  async function apiAvailable() {
    const now = Date.now();
    if (_apiCache && now - _apiCache.ts < API_CACHE_TTL) return _apiCache.ok;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000); // 4 s timeout
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      _apiCache = { ok: res.ok, ts: now };
    } catch {
      _apiCache = { ok: false, ts: now };
    }
    return _apiCache.ok;
  }

  async function createLink({ url, slug }) {
    if (await apiAvailable()) {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, slug }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'request_failed');
      return res.json();
    }
    // Demo / offline mode
    const list = readLocal();
    if (list.length >= FREE_LIMIT) throw new Error('limit_reached');
    const finalSlug = slug || randomSlug();
    if (list.some((l) => l.slug === finalSlug)) throw new Error('slug_taken');
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      slug: finalSlug,
      url,
      clicks: 0,
      active: true,
      created_at: new Date().toISOString(),
      country_breakdown: {},
      device_breakdown: {},
      browser_breakdown: {},
      click_history: [],
    };
    list.unshift(item);
    writeLocal(list);
    return item;
  }

  async function listLinks() {
    if (await apiAvailable()) {
      const res = await fetch(`${API_BASE}/links`);
      if (res.ok) return res.json();
    }
    return readLocal();
  }

  async function deleteLink(id) {
    if (await apiAvailable()) {
      const res = await fetch(`${API_BASE}/links/${id}`, { method: 'DELETE' });
      if (res.ok) return true;
    }
    const list = readLocal().filter((l) => l.id !== id);
    writeLocal(list);
    return true;
  }

  async function toggleLink(id) {
    const list = readLocal();
    const item = list.find((l) => l.id === id);
    if (item) { item.active = !item.active; writeLocal(list); }
    return item;
  }

  async function getLink(idOrSlug) {
    if (await apiAvailable()) {
      const res = await fetch(`${API_BASE}/links/${idOrSlug}`);
      if (res.ok) return res.json();
    }
    const list = readLocal();
    return list.find((l) => l.id === idOrSlug || l.slug === idOrSlug);
  }

  window.ShortixData = { createLink, listLinks, deleteLink, toggleLink, getLink, FREE_LIMIT };
})();
