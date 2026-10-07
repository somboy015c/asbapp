/* App shell: tabs, page stack, back button, theme, data refresh, boot sequence. */
(() => {
  'use strict';
  const { $, $$, sleep } = App;
  const ui = App.ui, cfg = App.cfg, S = App.state;
  const P = (window.Capacitor && window.Capacitor.Plugins) || {};
  const TABS = [['home', 'Home', 'home'], ['shop', 'Buy Data', 'data'], ['orders', 'Orders', 'receipt'], ['support', 'Support', 'help'], ['me', 'Me', 'user']];
  const rendered = {}, stale = {};
  let cur = 'home';
  App.screens.shop.once = App.screens.support.once = true;

  /* ---------- tabs ---------- */
  App.markStale = (...n) => n.forEach((x) => { stale[x] = true; });
  App.refresh = (name, force) => {
    const sc = App.screens[name], root = $('#tab-' + name);
    if (!sc || (rendered[name] && sc.once && !force)) return;
    const top = root.scrollTop;
    root.innerHTML = sc.render();
    if (sc.mount) sc.mount(root);
    root.scrollTop = top;
    rendered[name] = true; stale[name] = false;
  };
  App.tab = (name) => {
    if (name === cur) { $('#tab-' + name).scrollTo({ top: 0, behavior: 'smooth' }); return; }
    cur = name;
    $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (!rendered[name] || stale[name]) App.refresh(name);
  };

  /* ---------- pushed pages ---------- */
  App.nav = {
    stack: [],
    push(html) {
      const p = document.createElement('div');
      p.className = 'page'; p.innerHTML = html;
      $('#stack').appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('in')));
      App.nav.stack.push(p);
      return p;
    },
    pop() {
      const p = App.nav.stack.pop(); if (!p) return;
      p.classList.remove('in'); setTimeout(() => p.remove(), 450);
    },
    closeAll() { while (App.nav.stack.length) App.nav.pop(); },
  };

  /* ---------- theme ---------- */
  App.setTheme = (mode) => {
    document.documentElement.dataset.theme = mode;
    App.store.set('theme', mode);
    App.native.statusBar(mode === 'dark');
    ['home', 'me'].forEach((n) => rendered[n] && App.refresh(n, true));
  };

  /* ---------- global tap routing ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target; let el;
    if ((el = t.closest('[data-back]'))) { const page = el.closest('.page'); if (!(page && page._stepBack && page._stepBack())) App.nav.pop(); return; }
    if ((el = t.closest('[data-tab]'))) { App.tab(el.dataset.tab); return; }
    if ((el = t.closest('[data-shop]'))) { App.openShop(el.dataset.shop); return; }
    if ((el = t.closest('[data-url]'))) { const u = el.dataset.url; App.native.open(u.startsWith('/') ? cfg.SITE + u : u); return; }
    if ((el = t.closest('[data-order]'))) { App.screens.orders.open(el.dataset.order); return; }
    if ((el = t.closest('[data-act]'))) { const fn = App.actions[el.dataset.act]; if (fn) fn(el, e); }
  });
  Object.assign(App.actions, {
    theme: () => App.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
    agent: () => App.agent.open(),
    eye: () => { App.store.set('hide_balance', !App.store.get('hide_balance', false)); App.refresh('home', true); },
  });

  /* ---------- Android back button ---------- */
  App.back = () => {
    const sh = ui.sheets[ui.sheets.length - 1];
    if (sh) { if (!sh.persistent) sh.close(); return true; }
    const page = App.nav.stack[App.nav.stack.length - 1];
    if (page) { if (!(page._stepBack && page._stepBack())) App.nav.pop(); return true; }
    if (!$('#onboard').hidden) return App.onboarding.back ? App.onboarding.back() : false;
    if (cur !== 'home') { App.tab('home'); return true; }
    return false;
  };
  let lastBack = 0;
  if (P.App) P.App.addListener('backButton', () => {
    if (App.back()) return;
    if (Date.now() - lastBack < 1800) App.native.exit(); else { lastBack = Date.now(); ui.toast('Press back again to exit'); }
  });

  /* ---------- data ---------- */
  App.refreshData = async () => {
    if (!App.session.loggedIn) return;
    const [me, w, o] = await Promise.all([App.api('/me'), App.api('/wallet'), App.api('/orders', { query: { per_page: 30 } })]);
    if (me.ok) { S.user = me.data.data || me.data; App.store.set('user', S.user); }
    if (App.isAgent()) { const aw = await App.api('/agent/wallet'); if (aw.ok) S.agentWallet = aw.data.data || aw.data; }
    if (w.ok) S.wallet = w.data.data || w.data;
    if (o.ok) S.orders = o.data.data;
    App.markStale('home', 'orders', 'me');
    ['home', 'me'].forEach((n) => { if (rendered[n] && $('#tab-' + n).classList.contains('on')) App.refresh(n, true); });
  };
  App.onSessionLost = () => { ui.toast('You were logged out. Please log in again.'); ['home', 'orders', 'me'].forEach((n) => rendered[n] && App.refresh(n, true)); };

  const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  App.checkUpdate = async () => {
    if (!cfg.REPO || cfg.REPO.startsWith('__')) return null;
    try {
      const r = await fetch(`https://api.github.com/repos/${cfg.REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) return null;
      const rel = await r.json(), v = String(rel.tag_name || '').replace(/^v/, '');
      if (!v || !newer(v, S.version) || !(rel.assets || []).some((a) => a.name === cfg.APK_NAME)) return null;
      S.update = { version: v, url: `https://github.com/${cfg.REPO}/releases/latest/download/${cfg.APK_NAME}` };
      App.markStale('home');
      return S.update;
    } catch (_) { return null; }
  };

  /* ---------- boot ---------- */
  (async function boot() {
    await App.store.init();
    App.session.load();
    const saved = App.store.get('theme');
    const mode = saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = mode;
    App.native.statusBar(mode === 'dark');
    S.version = await App.native.version();

    $('#nav').innerHTML = TABS.map(([k, label, ic], i) => `<button class="tap${i ? '' : ' on'}" data-tab="${k}" data-quiet="1"><span class="pillbg">${ui.icon(ic)}</span><span>${label}</span></button>`).join('');
    setTimeout(() => App.native.hideSplash(), 120);

    const warm = Promise.race([Promise.all([
      App.api('/settings/public', { auth: false }).then((r) => { if (r.ok) S.guestEnabled = !!r.data.guest_checkout_enabled; }),
      App.refreshData(),
    ]), sleep(4500)]);
    await Promise.all([sleep(cfg.MIN_SPLASH_MS), warm]);

    let after = 'home';
    if (!App.store.get('onboarded')) {
      $('#splash').classList.add('out');
      after = await App.onboarding.run();
    }
    $('#main').hidden = false;
    TABS.forEach(([k]) => { if (k === 'home') App.refresh('home'); });
    $('#splash').classList.add('out');
    setTimeout(() => ($('#splash').hidden = true), 700);
    if (after === 'login') setTimeout(() => App.screens.login.open(), 250);
    App.checkUpdate().then((u) => { if (u && cur === 'home') App.refresh('home', true); });
  })();
})();
