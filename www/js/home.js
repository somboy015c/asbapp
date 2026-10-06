/* Home tab: greeting, wallet / welcome card, quick services, agent promo, recent orders. */
(() => {
  'use strict';
  const { esc } = App;
  const ui = App.ui, fmt = App.fmt;

  App.screens.home = {
    render() {
      const S = App.state, logged = App.session.loggedIn;
      const dark = document.documentElement.dataset.theme === 'dark';
      const name = logged ? fmt.first(S.user && S.user.name) || 'there' : 'Guest';
      const hide = App.store.get('hide_balance', false);
      const recent = (logged ? S.orders || [] : App.guestOrders.list()).slice(0, 3);

      const hero = logged ? `
        <div class="hero-top"><div class="hero-row">
          <div><div class="hero-label">Wallet Balance <button data-act="eye" aria-label="Toggle balance" style="color:#fff">${ui.icon(hide ? 'eye-off' : 'eye')}</button></div>
          <div class="hero-amt">${hide ? '••••••' : S.wallet ? fmt.money(S.wallet.balance) : fmt.money(0)}</div>
          <div class="hero-sub">Refunds are credited here</div></div>
          <button class="chip tap" data-tab="shop">${ui.icon('plus')} Buy Data</button>
        </div></div>` : `
        <div class="hero-top"><div class="hero-row">
          <div><div class="hero-label">Welcome to ASBData</div>
          <div class="hero-amt" style="font-size:25px">Buy data in seconds</div>
          <div class="hero-sub">No account needed</div></div>
          <button class="chip tap" data-act="login">Log in</button>
        </div></div>`;

      const banners = [
        S.update ? `<div class="banner">${ui.icon('download')}<div><b>Update available</b>Version ${esc(S.update.version)} is ready.</div><button class="tap" data-url="${esc(S.update.url)}">Get it</button></div>` : '',
        logged && S.user && S.user.email_verified === false ? `<div class="banner">${ui.icon('mail')}<div><b>Verify your email</b>We sent you a link.</div><button class="tap" data-act="resend-verify">Resend</button></div>` : '',
      ].join('');

      return `<div class="stag">
        <div class="top">
          <div class="hello"><div class="av">${logged ? esc(fmt.initials(S.user && S.user.name)) : ui.icon('user')}</div><span>Hi, ${esc(name)}</span></div>
          <div class="acts"><button class="round tap" data-act="theme" aria-label="Theme">${ui.icon(dark ? 'sun' : 'moon')}</button>
          <button class="round tap" data-tab="support" aria-label="Help">${ui.icon('help')}</button></div>
        </div>
        ${banners}
        <section class="hero">${hero}
          <div class="hero-bar">
            <button class="tap" data-tab="shop">${ui.icon('data')}Buy Data</button>
            <button class="tap" data-tab="orders">${ui.icon('receipt')}Orders</button>
            <button class="tap" data-tab="support">${ui.icon('help')}Support</button>
          </div>
        </section>
        <section class="card"><div class="svc">
          ${Object.entries(App.cfg.NETWORKS).map(([k, m]) => `<button class="tap" data-shop="${k}"><span class="net" style="background:${m.bg};color:${m.fg}">${esc(m.tag)}</span>${esc(m.name)}</button>`).join('')}
          <button class="tap" data-url="/become-agent.html"><span class="net alt">${ui.icon('briefcase')}</span>Agents</button>
        </div></section>
        <section class="card promo">
          <div><h3>Start your own data store</h3><p>Become an agent and earn on every bundle you sell.</p></div>
          <button class="btn btn-tonal btn-sm tap" data-url="/become-agent.html" aria-label="Open agent page">${ui.icon('external')}</button>
        </section>
        <section class="card">
          <div class="sec-head"><h3>Recent Orders</h3><button data-tab="orders">View all</button></div>
          ${recent.length ? recent.map((o, i) => ui.orderRow(o, i)).join('')
            : ui.empty('receipt', 'No orders yet', 'Your data purchases will show up here.', `<button class="btn btn-primary btn-sm tap" data-tab="shop">Buy data</button>`)}
        </section>
      </div>`;
    },
  };
})();
