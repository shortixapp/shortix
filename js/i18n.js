/* Shortix — i18n + theme engine */
(function () {
  const LOCALES = ['en', 'ar', 'fr', 'es', 'zh', 'pt'];
  const LOCALE_LABELS = { en: 'English', ar: 'العربية', fr: 'Français', es: 'Español', zh: '中文', pt: 'Português' };
  const FLAGS = { en: '🇬🇧', ar: '🇸🇦', fr: '🇫🇷', es: '🇪🇸', zh: '🇨🇳', pt: '🇵🇹' };

  // NOTE: project requested no emoji in UI; flags above are unused in markup,
  // kept only as a lookup table reference. We render text-only language names.

  const cache = {};

  function detectLocale() {
    const saved = localStorage.getItem('shortix_lang');
    if (saved && LOCALES.includes(saved)) return saved;
    const nav = (navigator.language || 'en').toLowerCase();
    const short = nav.split('-')[0];
    if (LOCALES.includes(short)) return short;
    if (short === 'zh') return 'zh';
    return 'en';
  }

  async function loadLocale(code) {
    if (cache[code]) return cache[code];
    const res = await fetch(`/locales/${code}.json`);
    const data = await res.json();
    cache[code] = data;
    return data;
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
    });
  }

  async function setLocale(code) {
    if (!LOCALES.includes(code)) code = 'en';
    const dict = await loadLocale(code);
    document.documentElement.lang = code;
    document.documentElement.dir = dict.dir || 'ltr';
    applyTranslations(dict);
    localStorage.setItem('shortix_lang', code);
    window.__shortixDict = dict;
    document.querySelectorAll('.dropdown-item[data-lang]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-lang') === code);
    });
    const label = document.getElementById('current-lang-label');
    if (label) label.textContent = LOCALE_LABELS[code] || code.toUpperCase();
    document.dispatchEvent(new CustomEvent('shortix:locale', { detail: { code, dict } }));
  }

  function detectTheme() {
    const saved = localStorage.getItem('shortix_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function setTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('shortix_theme', mode);
    document.querySelectorAll('[data-theme-icon]').forEach((el) => {
      el.setAttribute('data-active', mode);
    });
  }

  function initDropdowns() {
    document.querySelectorAll('.dropdown').forEach((dd) => {
      const trigger = dd.querySelector('[data-dropdown-trigger]');
      if (!trigger) return;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dd.classList.contains('open');
        document.querySelectorAll('.dropdown.open').forEach((o) => o.classList.remove('open'));
        if (!wasOpen) dd.classList.add('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown.open').forEach((o) => o.classList.remove('open'));
    });
  }

  function initLangMenu() {
    document.querySelectorAll('[data-lang]').forEach((item) => {
      item.addEventListener('click', () => {
        setLocale(item.getAttribute('data-lang'));
      });
    });
  }

  function initThemeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTheme(detectTheme());
    setLocale(detectLocale());
    initDropdowns();
    initLangMenu();
    initThemeToggle();
  });

  window.Shortix = window.Shortix || {};
  window.Shortix.setLocale = setLocale;
  window.Shortix.setTheme = setTheme;
  window.Shortix.LOCALES = LOCALES;
  window.Shortix.LOCALE_LABELS = LOCALE_LABELS;
})();
