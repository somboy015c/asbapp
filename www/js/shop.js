/* Buy Data tab + the full purchase flow (form -> secure payment -> live status). */
(() => {
  'use strict';
  const { $, $$, esc, sleep } = App;
  const ui = App.ui, fmt = App.fmt, cfg = App.cfg, S = App.state;
  const SLUGS = Object.keys(cfg.NETWORKS);

  const shop = (App.screens.shop = {
    net: 'mtn',
    render() {
      return `<div class="stag">
        <h1 class="page-title">Buy Data</h1><p class="page-sub">Pick a network, then a bundle. Delivered in minutes.</p>
        <div class="nets"><span class="ind"></span>${SLUGS.map((k) => `<button class="tap" data-net="${k}" data-quiet="1">${esc(cfg.NETWORKS[k].name)}</button>`).join('')}</div>
        <div class="grid" id="bundleGrid"></div></div>`;
    },
    mount(root) {
      root.addEventListener('click', (e) => {
        const n = e.target.closest('[data-net]'); if (n) { App.native.haptic('light'); shop.select(n.dataset.net); return; }
        const b = e.target.closest('[data-bundle]'); if (b) shop.buy(shop.net, S.bundles[shop.net].find((x) => String(x.id) === b.dataset.bundle));
        if (e.target.closest('[data-retry]')) shop.select(shop.net, true);
      });
      shop.select(shop.net);
    },
    async ensureNetworks() {
      if (Object.keys(S.networks).length) return true;
      const r = await App.api('/networks', { auth: false });
      if (!r.ok) return false;
      r.data.data.forEach((n) => { S.networks[n.slug] = n; });
      return true;
    },
    async select(slug, force) {
      shop.net = slug;
      const root = $('#tab-shop'); if (!root.querySelector('#bundleGrid')) return;
      const idx = SLUGS.indexOf(slug);
      $$('.nets button', root).forEach((b) => b.classList.toggle('on', b.dataset.net === slug));
      $('.nets .ind', root).style.transform = `translateX(${idx * 100}%)`;
      const grid = $('#bundleGrid', root);
      const who = App.session.loggedIn ? 'u' + ((S.user && S.user.id) || '') + (App.isAgent() ? 'a' : '') : 'guest';
      if (S.bundlesFor !== who) { S.bundles = {}; S.bundlesFor = who; }
      if (!S.bundles[slug] || force) {
        grid.innerHTML = Array.from({ length: 6 }, () => '<div class="bun"><i class="sk-av" style="width:100%;height:96px;border-radius:14px"></i></div>').join('');
        const ok = await shop.ensureNetworks();
        const net = S.networks[slug];
        const r = ok && net ? await App.api(`/networks/${net.id}/bundles`, { auth: App.session.loggedIn }) : null;
        if (shop.net !== slug) return;
        if (!r || !r.ok) { grid.innerHTML = `<div style="grid-column:1/-1">${ui.empty('wifi-off', 'Could not load bundles', (r && r.error) || 'Check your connection and try again.', '<button class="btn btn-tonal btn-sm tap" data-retry="1">Try again</button>')}</div>`; return; }
        S.bundles[slug] = r.data.data;
      }
      if (shop.net !== slug) return;
      const m = cfg.NETWORKS[slug];
      const list = S.bundles[slug];
      grid.innerHTML = list.length ? list.map((b, i) => `
        <button class="bun tap" data-bundle="${b.id}" style="--i:${i}">
          <div class="bun-top"><span class="net" style="background:${m.bg};color:${m.fg}">${esc(m.tag)}</span><span class="keep">No expiry</span></div>
          <div class="size">${esc(b.size_label)}</div>
          <div class="bun-bot"><span class="price">${fmt.money(b.price)}</span><span class="go">${ui.icon('arrow-right')}</span></div>
        </button>`).join('') : `<div style="grid-column:1/-1">${ui.empty('data', 'No bundles right now', 'Please check again shortly.')}</div>`;
    },

    /* ---------- purchase sheet ---------- */
    async buy(slug, b) {
      if (!b) return;
      const m = cfg.NETWORKS[slug], logged = App.session.loggedIn, gp = App.store.get('guest_profile', {});
      const agent = logged && App.isAgent();
      const price = Number(b.price);
      const gws = App.gatewaysFor(price);                       // gateways the admin switched on that accept this amount
      const many = gws.length > 1;
      const gwList = gws.length ? gws : [{ key: 'payaza', label: '' }];   // none listed: the server decides and explains
      const gwMethods = gwList.map((g) => agent
        ? { v: g.key, t: 'Pay directly', sub: 'Card or Mobile Money' + (many && g.label ? ' · ' + g.label : ''), off: false }
        : { v: g.key, t: 'Card or Mobile Money', sub: g.label ? 'Pay securely with ' + g.label : 'Pay securely', off: false });
      const methods = !logged ? (many ? gwMethods : []) : agent ? [
        { v: 'agent_wallet', t: 'Agent wallet', sub: fmt.money(S.agentWallet ? S.agentWallet.balance : 0), off: !(S.agentWallet && S.agentWallet.balance >= price) },
        { v: 'customer_wallet', t: 'Customer wallet', sub: fmt.money(S.wallet ? S.wallet.balance : 0), off: !(S.wallet && S.wallet.balance >= price) },
        ...gwMethods,
      ] : [
        ...gwMethods,
        { v: 'wallet', t: 'Wallet', sub: fmt.money(S.wallet ? S.wallet.balance : 0), off: !(S.wallet && S.wallet.balance >= price) },
      ];
      const firstOn = (methods.find((x) => !x.off) || methods[0] || { v: gwList[0].key }).v;
      const guestBlock = logged ? '' : S.guestEnabled ? `
        <div class="h-sec" style="margin-top:20px">Your details</div>
        <div class="field" style="margin-top:0"><div class="inp"><input id="g-first" placeholder="First name" autocomplete="given-name" value="${esc(gp.first || '')}" /></div></div>
        <div class="field" style="margin-top:10px"><div class="inp"><input id="g-last" placeholder="Last name" autocomplete="family-name" value="${esc(gp.last || '')}" /></div></div>
        <div class="field" style="margin-top:10px"><div class="inp"><input id="g-email" type="email" placeholder="Email address" autocomplete="email" value="${esc(gp.email || '')}" /></div></div>
        <div class="field" style="margin-top:10px"><div class="inp"><input id="g-phone" type="tel" inputmode="tel" placeholder="Your phone number" autocomplete="tel" value="${esc(gp.phone || '')}" /></div></div>
        ${many ? `<div class="h-sec" style="margin-top:18px">Pay with</div><div class="pay three">${gwMethods.map((x) => `<button class="${x.v === firstOn ? 'on' : ''}" data-pm="${x.v}">${esc(x.t)}<small>${esc(x.sub)}</small></button>`).join('')}</div>` : ''}
        <p class="note">We email your receipt. <button class="link" data-act="login-from-sheet">Have an account? Log in</button></p>` : `
        <div class="err-msg" style="margin-top:18px">Guest checkout is switched off right now. Please log in or create an account to buy data.</div>
        <div class="btn-col"><button class="btn btn-primary" data-act="login-from-sheet">Log in or sign up</button></div>`;
      const payBlock = logged ? `
        <div class="h-sec" style="margin-top:20px">Pay with</div>
        <div class="pay${methods.length >= 3 ? ' three' : ''}">${methods.map((x) => `<button class="${x.v === firstOn ? 'on' : ''}" data-pm="${x.v}" ${x.off ? 'disabled' : ''}>${esc(x.t)}<small>${esc(x.sub)}</small></button>`).join('')}</div>` : '';

      const sheet = ui.sheet({});
      sheet.set(`
        <div style="display:flex;align-items:center;gap:14px"><span class="net" style="background:${m.bg};color:${m.fg}">${esc(m.tag)}</span>
          <div><h3 class="sheet-title">${esc(b.size_label)} ${esc(m.name)}</h3><p class="sheet-sub" style="margin-top:2px">Non expiry data bundle</p></div></div>
        <label class="field"><span>Recipient number</span>
          <div class="inp" id="rcpt"><input id="num" inputmode="numeric" maxlength="14" placeholder="024 123 4567" autocomplete="off" />
          <span class="end ok" id="rcptOk">${ui.icon('check')}</span></div></label>
        ${guestBlock || ''}${payBlock}
        <div class="sum"><div><span>Bundle</span><b>${esc(b.size_label)} · ${esc(m.name)}</b></div><div class="tot"><span>Total</span><b>${fmt.money(b.price)}</b></div></div>
        <p class="note" style="margin-top:14px"><b>Double-check the number.</b> Once your order is placed and paid for, it cannot be undone or refunded.</p>
        <div id="buyErr"></div>
        ${logged || S.guestEnabled ? `<div class="btn-col" style="margin-top:12px"><button class="btn btn-primary tap" id="payBtn">Pay ${fmt.money(b.price)}</button></div>` : ''}`);

      const el = sheet.el; let method = firstOn || 'payaza';
      const num = $('#num', el);
      num.addEventListener('input', () => { $('#rcptOk', el).classList.toggle('on', /^\d{9,10}$/.test(fmt.local(num.value))); });
      el.addEventListener('click', (e) => {
        const pm = e.target.closest('[data-pm]');
        if (pm && !pm.disabled) { method = pm.dataset.pm; $$('[data-pm]', el).forEach((x) => x.classList.toggle('on', x === pm)); }
        if (e.target.closest('[data-act="login-from-sheet"]')) { sheet.close(); App.actions.login(); }
      });
      const pay = $('#payBtn', el); if (!pay) return;
      const showErr = (t) => { $('#buyErr', el).innerHTML = `<div class="err-msg">${esc(t)}</div>`; App.native.haptic('error'); };
      pay.addEventListener('click', async () => {
        $('#buyErr', el).innerHTML = '';
        const number = fmt.local(num.value);
        if (!/^\d{9,10}$/.test(number)) { $('#rcpt', el).classList.add('bad'); num.focus(); return showErr('Enter the 10-digit number that should receive the data.'); }
        $('#rcpt', el).classList.remove('bad');
        let guest = null;
        if (!logged) {
          guest = { first: $('#g-first', el).value.trim(), last: $('#g-last', el).value.trim(), email: $('#g-email', el).value.trim(), phone: $('#g-phone', el).value.trim() };
          if (!guest.first || !guest.last || !guest.email || !guest.phone) return showErr('Please fill in your first name, last name, email and phone number.');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) return showErr('Please enter a valid email address.');
          if (guest.phone.replace(/\D/g, '').length < 9) return showErr('Please enter a valid phone number.');
          App.store.set('guest_profile', guest);
        }
        ui.busy(pay, true, 'Processing');
        const r = logged
          ? await App.api(agent ? '/agent/orders' : '/orders', { method: 'POST', body: { data_bundle_id: Number(b.id), recipient_number: number, payment_method: method } })
          : await App.api('/orders/guest', { method: 'POST', auth: false, body: { first_name: guest.first, last_name: guest.last, email: guest.email, phone: guest.phone, data_bundle_id: Number(b.id), recipient_number: number, payment_method: method } });
        ui.busy(pay, false);
        if (!r.ok) {
          if (r.code === 'pin_required') { if (await App.agentPin()) pay.click(); return; }
          if (r.code === 'guest_checkout_disabled') S.guestEnabled = false;
          return showErr(r.error);
        }
        shop.track(sheet, { order: r.data.order, url: r.data.authorization_url, guest: !logged, network: m.name, size: b.size_label, number, amount: Number(b.price), method, gateways: gws });
      });
    },

    /* Finish paying for an order that is still waiting for payment (the same thing the website's email link does). */
    async resumeOrder(o) {
      const ref = o.guest ? o.ref : 'ORD-' + o.id;
      const gw = await App.pickGateway(o.amount);
      if (gw === undefined) return;
      const sheet = ui.sheet({});
      sheet.set(`<div class="res"><div class="wait-ring"></div><h3>Opening payment</h3></div>`);
      const r = await App.api(`/orders/payment/${encodeURIComponent(ref)}/resume`, { method: 'POST', auth: false, body: gw ? { payment_method: gw } : {} });
      if (!r.ok) { sheet.close(); return ui.toast(r.error, 'err'); }
      if (!r.data.authorization_url) { sheet.close(); ui.toast('This order is already paid. Checking its status…'); App.markStale('orders', 'home'); return App.refresh('orders', true); }
      shop.track(sheet, { order: { id: o.id }, url: r.data.authorization_url, guest: !!o.guest, network: o.network, size: o.size, number: o.number, amount: Number(o.amount), gateways: App.gatewaysFor(o.amount) });
    },

    /* ---------- payment tracking ---------- */
    track(sheet, c) {
      const id = c.order && c.order.id;
      // The first payment reference is always ORD-<order id>. Payaza also puts it in the URL; Korapay does not.
      let ref = (c.order && c.order.payment_reference) || null;
      if (!ref && c.url) { try { ref = new URL(c.url).searchParams.get('transaction_reference'); } catch (_) {} }
      if (!ref && id) ref = 'ORD-' + id;
      const verifyPath = c.guest ? `/orders/guest/verify/${encodeURIComponent(ref)}` : c.url ? `/orders/verify/${encodeURIComponent(ref)}` : `/orders/${id}`;
      const rec = { ref: ref || id, id, network: c.network, size: c.size, number: c.number, amount: c.amount, status: (c.order && c.order.status) || 'pending_payment', at: new Date().toISOString() };
      if (c.guest) App.guestOrders.upsert(rec);
      App.markStale('home', 'orders');
      const summary = `<div class="sum"><div><span>Network</span><b>${esc(c.network)}</b></div><div><span>Bundle</span><b>${esc(c.size)}</b></div><div><span>Recipient</span><b>${esc(c.number)}</b></div><div class="tot"><span>Amount</span><b>${fmt.money(c.amount)}</b></div></div>`;
      App.pay.track(sheet, {
        url: c.url,
        gateways: c.gateways,
        waitTitle: c.url ? 'Complete your payment' : 'Placing your order',
        waitText: c.url ? '' : 'Paying from your wallet…',
        summary,
        results: {
          ok: ['Order delivered', `Your ${c.size} ${c.network} bundle is on its way to ${c.number}.`],
          err: ['Order failed', 'Something went wrong. If you were charged, you will be refunded. Contact support with your order.'],
          warn: ['Payment not completed', 'We have not received your payment yet. If you already paid, wait a minute and check again.'],
          proc: ['Still processing', 'Your payment was received and the bundle is being delivered. This can take a few minutes.'],
        },
        // Only orders that were waiting on an online payment can be resumed.
        resume: c.url ? async (gatewayKey) => {
          const r = await App.api(`/orders/payment/${encodeURIComponent(ref)}/resume`, { method: 'POST', auth: false, body: gatewayKey ? { payment_method: gatewayKey } : {} });
          if (!r.ok) throw new Error(r.error);
          return r.data.authorization_url || null;
        } : null,
        // Re-checks with the gateway and emails the buyer a link to finish paying.
        onNotPaid: c.url ? async () => {
          const r = await App.api(`/orders/payment/${encodeURIComponent(ref)}/cancelled`, { method: 'POST', auth: false });
          return r.ok ? r.data : null;
        } : null,
        async check() {
          const r = await App.api(verifyPath, { auth: !c.guest });
          if (!r.ok) return null;
          const o = r.data.order || r.data.data || r.data;
          if (!o || !o.status) return null;
          rec.status = o.status;
          if (c.guest) App.guestOrders.upsert(rec);
          return { state: App.pay.orderState(o.status) };
        },
        onDone() { if (App.session.loggedIn) App.refreshData(); App.markStale('home', 'orders', 'me'); },
      });
    },
  });

  App.openShop = (slug) => { if (slug) shop.net = slug; App.tab('shop'); shop.select(shop.net); };
})();
