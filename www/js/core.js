/* Core: global App object, storage, native bridge, API client, formatting. */
(() => {
  'use strict';
  const cfg = window.ASB;
  const App = (window.App = {
    cfg, screens: {}, ui: {}, actions: {},
    state: { token: null, user: null, wallet: null, guestEnabled: true, gateways: [], networks: {}, bundles: {}, orders: null, guestOrders: [], update: null, version: '1.0.0' },
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
      if (App.store.get('haptics', false) !== true || !P.Haptics) return;   // off until the person turns it on
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
    /* Opens the payment page INSIDE the app. Calls onReturn() when the payment page sends the person back to
       our website (payment finished) and onClose() if they close the window. Falls back to the system
       browser tab if the in-app window plugin is not available. */
    async openPayment(url, { onReturn, onClose } = {}) {
      const IAB = P.InAppBrowser;
      const isReturn = (u) => { try { const h = new URL(u).hostname; return /(^|\.)asbdataghana\.com$/.test(h); } catch (_) { return false; } };
      if (IAB && IAB.openWebView) {
        const subs = [];
        const cleanup = () => subs.forEach((x) => { try { x.remove(); } catch (_) {} });
        let ended = false;
        const end = async (kind, backUrl) => {
          if (ended) return; ended = true; cleanup();
          if (kind === 'return') { try { await IAB.close(); } catch (_) {} onReturn && onReturn(backUrl); } else onClose && onClose();
        };
        try {
          subs.push(await IAB.addListener('urlChangeEvent', (e) => { if (e && e.url && isReturn(e.url)) end('return', e.url); }));
          subs.push(await IAB.addListener('closeEvent', () => end('close')));
          await IAB.openWebView({ url, title: 'Secure payment', showReloadButton: false, closeModal: false });
          return { close: async () => { if (!ended) { ended = true; cleanup(); try { await IAB.close(); } catch (_) {} } } };
        } catch (_) { cleanup(); }
      }
      if (P.Browser) {
        const subs = [];
        P.Browser.addListener('browserFinished', () => { onClose && onClose(); }).then((x) => subs.push(x)).catch(() => {});
        App.native.open(url);
        return { close: async () => { try { await P.Browser.close(); } catch (_) {} subs.forEach((x) => { try { x.remove(); } catch (_) {} }); } };
      }
      window.open(url, '_blank');
      return { close: async () => {} };
    },
    async version() {
      try { if (P.App) return (await P.App.getInfo()).version; } catch (_) {}
      return App.state.version;
    },
  };

  /* ---------- API client ---------- */
  App.api = async (path, { method = 'GET', body, query, auth = true, form } = {}) => {
    let url = cfg.API_BASE + path;
    if (query) {
      const qs = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      if ([...qs].length) url += '?' + qs.toString();
    }
    const headers = { Accept: 'application/json' };
    if (form) body = form;                                  // multipart upload: let the browser set the boundary
    else if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && App.state.token) headers.Authorization = 'Bearer ' + App.state.token;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    let res;
    try {
      const payload = body === undefined ? undefined : form ? body : JSON.stringify(body);
      try {
        res = await fetch(url, { method, headers, body: payload, signal: ctl.signal });
      } catch (e) {
        // File uploads: if the native HTTP layer can't send it, retry through the WebView's own fetch.
        if (form && window.CapacitorWebFetch) res = await window.CapacitorWebFetch(url, { method, headers, body: payload, signal: ctl.signal });
        else throw e;
      }
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
    clear() { App.state.token = App.state.user = App.state.wallet = App.state.agentWallet = null; App.state.orders = null; App.store.remove('token'); App.store.remove('user'); },
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

  /* ---------- images: shrink a picked photo so uploads are small and always under the server limit ---------- */
  App.img = {
    prepare(file, maxPx = 1280, quality = 0.82) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
          const r = Math.min(1, maxPx / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('Could not read that image.')); }, 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
        img.src = url;
      });
    },
  };
  App.gatewaysFor = (price) => (App.state.gateways || []).filter((g) => !(g.min_amount > 0) || Number(price) + 0.001 >= g.min_amount);
  App.isAgent = () => !!(App.state.user && App.state.user.agent_status === 'approved');

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
