/* Shortix — dashboard logic */
(function () {
  let allLinks = [];
  let pendingDeleteId = null;

  function showToast(msg, type) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderRow(item) {
    const dict = window.__shortixDict || {};
    const isActive = item.active !== false;
    const tr = document.createElement('tr');

    const tdLink = document.createElement('td');
    const linkCell = document.createElement('div');
    linkCell.className = 'link-cell';
    const shortSpan = document.createElement('span');
    shortSpan.className = 'short';
    shortSpan.textContent = `${location.host}/${item.slug}`;
    const origSpan = document.createElement('span');
    origSpan.className = 'orig';
    origSpan.textContent = item.url;
    linkCell.appendChild(shortSpan);
    linkCell.appendChild(origSpan);
    tdLink.appendChild(linkCell);

    const tdClicks = document.createElement('td');
    tdClicks.textContent = (item.clicks || 0).toLocaleString();

    const tdStatus = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'status-pill' + (isActive ? '' : ' off');
    pill.textContent = isActive ? (dict['dash.active'] || 'Active') : (dict['dash.disabled'] || 'Disabled');
    tdStatus.appendChild(pill);

    const tdDate = document.createElement('td');
    tdDate.className = 'muted';
    tdDate.textContent = fmtDate(item.created_at);

    const tdActions = document.createElement('td');
    tdActions.innerHTML = `
      <div class="row-actions">
        <button data-action="copy" aria-label="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg></button>
        <button data-action="stats" aria-label="Stats"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l3 9 4-18 3 9h4"/></svg></button>
        <button data-action="delete" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6"/></svg></button>
      </div>`;
    tdActions.querySelector('[data-action="copy"]').dataset.slug = item.slug;
    tdActions.querySelector('[data-action="stats"]').dataset.id = item.id;
    tdActions.querySelector('[data-action="stats"]').dataset.slug = item.slug;
    tdActions.querySelector('[data-action="delete"]').dataset.id = item.id;

    tr.appendChild(tdLink);
    tr.appendChild(tdClicks);
    tr.appendChild(tdStatus);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);
    return tr;
  }

  function renderKpis(links) {
    const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
    const active = links.filter((l) => l.active !== false).length;
    const top = links.slice().sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
    document.getElementById('kpi-clicks').textContent = totalClicks.toLocaleString();
    document.getElementById('kpi-active').textContent = active.toLocaleString();
    document.getElementById('kpi-top').textContent = top ? `/${top.slug}` : '—';
    document.getElementById('kpi-avg').textContent = links.length ? Math.round(totalClicks / links.length).toLocaleString() : '0';
  }

  function render(filter = '') {
    const tbody = document.getElementById('links-tbody');
    const empty = document.getElementById('empty-state');
    const wrap = document.getElementById('table-wrap');
    tbody.innerHTML = '';
    const filtered = allLinks.filter((l) =>
      !filter || l.slug.includes(filter) || l.url.toLowerCase().includes(filter.toLowerCase())
    );
    if (!filtered.length) {
      wrap.classList.add('hidden');
      empty.classList.remove('hidden');
    } else {
      wrap.classList.remove('hidden');
      empty.classList.add('hidden');
      filtered.forEach((item) => tbody.appendChild(renderRow(item)));
    }
    renderKpis(allLinks);
  }

  async function refresh() {
    allLinks = await window.ShortixData.listLinks();
    render(document.getElementById('search-input').value);
  }

  function openModal(id) { document.getElementById(id).classList.add('show'); }
  function closeModal(id) { document.getElementById(id).classList.remove('show'); }

  async function submitCreateLink() {
    const url = document.getElementById('modal-url').value.trim();
    const slug = document.getElementById('modal-slug').value.trim();
    if (!url) return;
    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
    const submitBtn = document.getElementById('modal-submit');
    submitBtn.disabled = true;
    try {
      await window.ShortixData.createLink({ url: normalized, slug: slug || undefined });
      closeModal('create-modal');
      document.getElementById('modal-url').value = '';
      document.getElementById('modal-slug').value = '';
      const dict = window.__shortixDict || {};
      showToast(dict['toast.created'] || 'Link created', 'success');
      refresh();
    } catch (err) {
      const dict = window.__shortixDict || {};
      if (err.message === 'limit_reached') {
        showToast('Free limit reached (5 links) — upgrade to Pro for unlimited links.');
      } else if (err.message === 'slug_taken') {
        showToast('That slug is already taken.');
      } else {
        showToast(dict['toast.error'] || 'Something went wrong');
      }
    } finally {
      submitBtn.disabled = false;
    }
  }

  function initModals() {
    document.getElementById('new-link-btn').addEventListener('click', () => openModal('create-modal'));
    document.getElementById('modal-cancel').addEventListener('click', () => closeModal('create-modal'));
    document.getElementById('delete-cancel').addEventListener('click', () => closeModal('delete-modal'));

    // Submit via button click (not form submit, avoiding form tag issues)
    document.getElementById('modal-submit').addEventListener('click', submitCreateLink);

    // Allow Enter key in inputs to submit
    ['modal-url', 'modal-slug'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitCreateLink(); }
      });
    });

    document.getElementById('delete-confirm').addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      await window.ShortixData.deleteLink(pendingDeleteId);
      closeModal('delete-modal');
      const dict = window.__shortixDict || {};
      showToast(dict['toast.deleted'] || 'Link deleted');
      pendingDeleteId = null;
      refresh();
    });

    [...document.querySelectorAll('.modal-overlay')].forEach((ov) => {
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('show'); });
    });
  }

  function initTableActions() {
    document.getElementById('links-tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'copy') {
        const url = `${location.origin}/${btn.dataset.slug}`;
        await navigator.clipboard.writeText(url);
        const dict = window.__shortixDict || {};
        showToast(dict['toast.copied'] || 'Copied');
      } else if (action === 'delete') {
        pendingDeleteId = btn.dataset.id;
        openModal('delete-modal');
      } else if (action === 'stats') {
        window.location.href = `/stats.html?id=${encodeURIComponent(btn.dataset.id)}`;
      }
    });
  }

  function initSearch() {
    document.getElementById('search-input').addEventListener('input', (e) => render(e.target.value));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initModals();
    initTableActions();
    initSearch();
    refresh();
  });
})();
