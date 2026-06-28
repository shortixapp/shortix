/* Shortix — Stripe Checkout helper
   Called from index.html and dashboard.html upgrade buttons.
   Opens Stripe Checkout for the Pro plan subscription.            */
(function () {
  async function startCheckout(email) {
    try {
      const btn = document.getElementById('upgrade-btn') || document.getElementById('sidebar-upgrade');
      if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }

      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'stripe_not_configured') {
          alert('Payment is not yet configured. Please check back soon.');
        } else {
          alert('Could not open checkout — please try again.');
        }
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Upgrade to Pro'; }
        return;
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch {
      alert('Network error — please try again.');
    }
  }

  function handleUpgradeClick() {
    // If there's a known email (future: from auth), pass it along
    startCheckout(null);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const upgradeBtn = document.getElementById('upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.dataset.label = upgradeBtn.textContent;
      upgradeBtn.addEventListener('click', handleUpgradeClick);
    }

    const sidebarUpgrade = document.getElementById('sidebar-upgrade');
    if (sidebarUpgrade) {
      sidebarUpgrade.dataset.label = sidebarUpgrade.textContent;
      sidebarUpgrade.addEventListener('click', handleUpgradeClick);
    }

    // Handle post-checkout query params
    const params = new URLSearchParams(location.search);

    if (params.has('upgraded') && params.get('upgraded') === '1') {
      // Show a success toast/banner
      const dict = window.__shortixDict || {};
      const msg = dict['toast.upgraded'] || '🎉 You\'re now on Pro! Welcome aboard.';
      const stack = document.getElementById('toast-stack');
      if (stack) {
        const t = document.createElement('div');
        t.className = 'toast toast-success';
        t.textContent = msg;
        stack.appendChild(t);
        setTimeout(() => t.remove(), 5000);
      }
      // Remove param from URL without reload
      history.replaceState({}, '', location.pathname);
    }

    if (params.has('notfound') && params.get('notfound') === '1') {
      const dict = window.__shortixDict || {};
      const msg = dict['toast.notfound'] || 'That short link was not found.';
      const stack = document.getElementById('toast-stack');
      if (stack) {
        const t = document.createElement('div');
        t.className = 'toast toast-error';
        t.textContent = msg;
        stack.appendChild(t);
        setTimeout(() => t.remove(), 4000);
      }
      history.replaceState({}, '', location.pathname);
    }

    if (params.has('upgrade') && params.get('upgrade') === '1') {
      // Show upgrade prompt banner
      const dict = window.__shortixDict || {};
      const msg = dict['toast.upgrade_prompt'] || 'Upgrade to Pro for unlimited links.';
      const stack = document.getElementById('toast-stack');
      if (stack) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        stack.appendChild(t);
        setTimeout(() => t.remove(), 5000);
      }
      history.replaceState({}, '', location.pathname);
    }
  });

  window.ShortixStripe = { startCheckout };
})();
