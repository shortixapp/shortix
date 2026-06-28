/* Shortix — landing page logic */
(function () {
  function showToast(msg) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function animateCount(el, target, suffix = '') {
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const suffix = el.getAttribute('data-count-suffix') || '';
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateCount(el, target, suffix);
            io.disconnect();
          }
        });
      }, { threshold: 0.4 });
      io.observe(el);
    });
  }

  function buildShortUrl(slug) {
    return `${location.origin}/${slug}`;
  }

  function renderQr(container, text) {
    container.innerHTML = '';
    if (window.QRCode) {
      new QRCode(container, { text, width: 96, height: 96, colorDark: '#11122b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }
  }

  function initShortenForm() {
    const form = document.getElementById('shorten-form');
    if (!form) return;
    const input = document.getElementById('url-input');
    const resultBox = document.getElementById('result-box');
    const resultLink = document.getElementById('result-link');
    const copyBtn = document.getElementById('copy-btn');
    const qrBtn = document.getElementById('qr-btn');
    const qrBox = document.getElementById('qr-box');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = input.value.trim();
      if (!url) return;
      let normalized = url;
      if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
      try {
        new URL(normalized);
      } catch {
        showToast(window.__shortixDict?.['toast.error'] || 'Invalid URL');
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const item = await window.ShortixData.createLink({ url: normalized });
        const shortUrl = buildShortUrl(item.slug);
        resultLink.textContent = shortUrl;
        resultLink.dataset.url = shortUrl;
        resultBox.classList.add('show');
        qrBox.classList.add('hidden');
        qrBox.innerHTML = '';
        input.value = '';
      } catch (err) {
        const dict = window.__shortixDict || {};
        if (err.message === 'limit_reached') {
          showToast('You\u2019ve reached the 5-link free limit \u2014 sign up for unlimited links.');
        } else if (err.message === 'slug_taken') {
          showToast('That slug is already taken.');
        } else {
          showToast(dict['toast.error'] || 'Something went wrong');
        }
      } finally {
        submitBtn.disabled = false;
      }
    });

    copyBtn?.addEventListener('click', async () => {
      const url = resultLink.dataset.url;
      if (!url) return;
      await navigator.clipboard.writeText(url);
      const dict = window.__shortixDict || {};
      showToast(dict['toast.copied'] || 'Copied');
    });

    qrBtn?.addEventListener('click', () => {
      const url = resultLink.dataset.url;
      if (!url) return;
      qrBox.classList.remove('hidden');
      renderQr(qrBox, url);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCounters();
    initShortenForm();
  });
})();
