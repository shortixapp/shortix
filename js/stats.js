/* Shortix — stats page logic
   Loads real click data from Supabase (clicks table) when available,
   falls back to seeded demo data when in localStorage/offline mode.  */
(function () {

  // ─── Demo data (used when no real data is available) ───────────────
  function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function demoSeries(item) {
    const rnd = seededRandom((item.id || 'x').length * 97 + (item.clicks || 1));
    const days = 14;
    const labels = [], data = [];
    const base = Math.max(1, Math.round((item.clicks || 40) / days));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      data.push(Math.max(0, Math.round(base * (0.5 + rnd() * 1.3))));
    }
    return { labels, data };
  }

  // ─── Real data from Supabase ────────────────────────────────────────
  async function fetchRealClickData(linkId) {
    const sb = window.ShortixAuth?.client();
    if (!sb || !linkId) return null;

    try {
      // Get clicks for this link from the last 14 days
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const { data: clicks, error } = await sb
        .from('clicks')
        .select('created_at, country, device, browser')
        .eq('link_id', linkId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      if (error || !clicks || !clicks.length) return null;

      // Build 14-day series
      const dayMap = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = 0;
      }
      clicks.forEach(c => {
        const key = c.created_at.slice(0, 10);
        if (key in dayMap) dayMap[key]++;
      });

      const labels = Object.keys(dayMap).map(k => {
        const d = new Date(k + 'T12:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      });
      const data = Object.values(dayMap);

      // Country breakdown
      const countryMap = {};
      clicks.forEach(c => { countryMap[c.country || 'Unknown'] = (countryMap[c.country || 'Unknown'] || 0) + 1; });
      const total = clicks.length || 1;
      const countries = Object.entries(countryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, pct: Math.round(count / total * 100) }));

      // Device breakdown
      const deviceMap = {};
      clicks.forEach(c => { deviceMap[c.device || 'Unknown'] = (deviceMap[c.device || 'Unknown'] || 0) + 1; });
      const devices = Object.entries(deviceMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, pct: Math.round(count / total * 100) }));

      return { labels, data, countries, devices };
    } catch {
      return null;
    }
  }

  // ─── Chart rendering ────────────────────────────────────────────────
  let chartInstance = null;

  function renderChart(labels, data) {
    const ctx = document.getElementById('clicks-chart');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#51527a' : '#9c9cc0';
    const gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Clicks',
          data,
          borderColor: '#5b8dee',
          backgroundColor: 'rgba(91,141,238,.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
        },
      },
    });
  }

  function renderBars(container, rows) {
    if (!rows || !rows.length) {
      container.innerHTML = '<p class="muted" style="padding:12px 0;font-size:13px;">No data yet.</p>';
      return;
    }
    container.innerHTML = rows.map((r) => `
      <div class="country-row">
        <span class="name">${r.name}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${r.pct}%"></span></span>
        <span class="pct">${r.pct}%</span>
      </div>
    `).join('');
  }

  // ─── Theme change support for Chart.js ──────────────────────────────
  const themeObserver = new MutationObserver(() => {
    if (chartInstance) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const textColor = isLight ? '#51527a' : '#9c9cc0';
      const gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';
      chartInstance.options.scales.x.ticks.color = textColor;
      chartInstance.options.scales.y.ticks.color = textColor;
      chartInstance.options.scales.y.grid.color = gridColor;
      chartInstance.update();
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ─── Main init ──────────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id') || params.get('slug');
    let item = null;
    if (id) item = await window.ShortixData.getLink(id);
    if (!item) {
      const all = await window.ShortixData.listLinks();
      item = all[0];
    }
    if (!item) {
      document.querySelector('.app-main').innerHTML =
        '<p class="muted" style="padding:32px;">No link data yet. Create a link from the dashboard first.</p>';
      return;
    }

    document.getElementById('stats-link-label').textContent = `${location.host}/${item.slug}`;
    document.getElementById('s-clicks').textContent = (item.clicks || 0).toLocaleString();
    document.getElementById('s-created').textContent = new Date(item.created_at).toLocaleDateString();

    // Try to get real data from Supabase
    const real = await fetchRealClickData(item.id);

    if (real) {
      // Real data available
      renderChart(real.labels, real.data);
      document.getElementById('s-country').textContent = real.countries[0]?.name || '—';
      document.getElementById('s-device').textContent = real.devices[0]?.name || '—';
      renderBars(document.getElementById('country-list'), real.countries);
      renderBars(document.getElementById('device-list'), real.devices);
    } else {
      // Demo / offline fallback
      const series = demoSeries(item);
      renderChart(series.labels, series.data);

      const demoCountries = [
        { name: 'United States', pct: 34 }, { name: 'Algeria', pct: 18 },
        { name: 'France', pct: 14 }, { name: 'Brazil', pct: 11 },
        { name: 'Germany', pct: 9 }, { name: 'Other', pct: 14 },
      ];
      const demoDevices = [
        { name: 'Mobile', pct: 58 }, { name: 'Desktop', pct: 35 }, { name: 'Tablet', pct: 7 },
      ];
      document.getElementById('s-country').textContent = demoCountries[0].name;
      document.getElementById('s-device').textContent = demoDevices[0].name;
      renderBars(document.getElementById('country-list'), demoCountries);
      renderBars(document.getElementById('device-list'), demoDevices);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
