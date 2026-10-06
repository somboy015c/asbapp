/* Core: global App object, storage, native bridge, API client, formatting. */
(() => {
  'use strict';
  const cfg = window.ASB;
  const App = (window.App = {
    cfg, screens: {}, ui: {}, actions: {},
    state: { token: null, user: null, wallet: null, guestEnabled: true, networks: {}, bundles: {}, orders: null, guestOrders: [], update: null, version: '1.0.0' },
  });
  const Cap = window.Capacitor || {};
  const P = Cap.Plugins || {};
  App.isNative = !!(Cap.isNativePlatform && Cap.isNativePlatform());
  App.$ = (s, r = document) => r.querySelector(s);
  App.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  App.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  App.esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- storage (Capacitor Preferences, falls back to localStorage) ---------- */
  const KEYS = ['token', 'user', 'onboarded', 'theme', 'haptics', 'guest_profile', 'guest_orders', 'hide_balance'];
  const mem = {};
  App.store = {
    async init() {
      for (const k of KEYS) {
        try {
          mem[k] = P.Preferences ? (await P.Preferences.get({ key: 'asb_' + k })).value : localStorage.getItem('asb_' + k);
        } catch (_) { mem[k] = null; }
      }
    },
    get(k, def = null) { try { return mem[k] == null ? def : JSON.parse(mem[k]); } catch (_) { return def; } },
    set(k, v) {
      mem[k] = JSON.stringify(v);
      try { P.Preferences ? P.Preferences.set({ key: 'asb_' + k, value: mem[k] }) : localStorage.setItem('asb_' + k, mem[k]); } catch (_) {}
    },
    remove(k) {
      delete mem[k];
      try { P.Preferences ? P.Preferences.remove({ key: 'asb_' + k }) : localStorage.removeItem('asb_' + k); } catch (_) {}
    },
  };

  /* ---------- native bridge (every call is safe in a normal browser too) ---------- */
  App.native = {
    open(url) {
      if (P.Browser) return P.Browser.open({ url, presentationStyle: 'popover' }).catch(() => window.open(url, '_blank'));
      window.open(url, '_blank');
    },
    link(url) { window.location.href = url; },          // tel: / mailto:
    haptic(kind = 'light') {
      if (App.store.get('haptics', true) === false || !P.Haptics) return;
      try {
        if (kind === 'success' || kind === 'error') P.Haptics.notification({ type: kind === 'success' ? 'SUCCESS' : 'ERROR' });
        else P.Haptics.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      } catch (_) {}
    },
    async statusBar(dark) {
      if (!P.StatusBar) return;
      try { await P.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch (_) {}
    },
    hideSplash() { if (P.SplashScreen) P.SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}); },
    exit() { if (P.App) P.App.exitApp(); },
    async version() {
      try { if (P.App) return (await P.App.getInfo()).version; } catch (_) {}
      return App.state.version;
    },
  };

  /* ---------- API client ---------- */
  App.api = async (path, { method = 'GET', body, query, auth = true } = {}) => {
    let url = cfg.API_BASE + path;
    if (query) {
      const qs = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      if ([...qs].length) url += '?' + qs.toString();
    }
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && App.state.token) headers.Authorization = 'Bearer ' + App.state.token;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    let res;
    try {
      res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctl.signal });
    } catch (_) {
      return { ok: false, status: 0, data: null, code: 'offline', error: "Can't reach the server. Check your internet connection." };
    } finally { clearTimeout(timer); }

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (res.status === 401 && auth && App.state.token) { App.session.clear(); App.onSessionLost && App.onSessionLost(); }
    if (!res.ok) {
      let msg = (data && data.message) || 'Something went wrong. Please try again.';
      if (data && data.errors) { const f = Object.values(data.errors)[0]; if (f && f[0]) msg = f[0]; }
      return { ok: false, status: res.status, data, code: data && data.code, error: msg };
    }
    return { ok: true, status: res.status, data, error: null };
  };

  /* ---------- session ---------- */
  App.session = {
    load() { App.state.token = App.store.get('token'); App.state.user = App.store.get('user'); },
    save(token, user) { App.state.token = token; App.state.user = user; App.store.set('token', token); App.store.set('user', user); },
    clear() { App.state.token = App.state.user = App.state.wallet = null; App.state.orders = null; App.store.remove('token'); App.store.remove('user'); },
    get loggedIn() { return !!App.state.token; },
  };

  /* ---------- formatting ---------- */
  App.fmt = {
    money: (n) => 'GH₵' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    date: (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    first: (name) => String(name || '').trim().split(/\s+/)[0] || '',
    initials: (name) => String(name || '?').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    label: (s) => { const t = String(s || '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); },
    // +233 24 123 4567 / 233241234567 -> 0241234567
    local: (v) => { const d = String(v || '').replace(/\D/g, ''); return d.startsWith('233') && d.length === 12 ? '0' + d.slice(3) : d; },
  };
  App.netMeta = (name) => {
    const k = String(name || '').toLowerCase().replace(/\s+/g, '');
    return cfg.NETWORKS[k] || { name: name || '?', tag: String(name || '?').slice(0, 2).toUpperCase(), bg: '#2A2FA0', fg: '#fff' };
  };

  /* ---------- guest order history (kept on the device) ---------- */
  App.guestOrders = {
    list: () => App.store.get('guest_orders', []),
    upsert(o) {
      const list = App.guestOrders.list().filter((x) => x.ref !== o.ref);
      list.unshift(o);
      App.store.set('guest_orders', list.slice(0, 50));
    },
  };
})();
