/* Agent dashboard, fully in the app: Overview, Store settings, Withdrawals, Security. */
(() => {
  'use strict';
  const { $, $$, esc } = App;
  const ui = App.ui, fmt = App.fmt, S = App.state, A = App.agent;

  const niceMax = (m) => { if (m <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(m))), n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const storeUrl = (st) => (st && (st.custom_domain ? 'https://' + st.custom_domain.replace(/^https?:\/\//, '') : st.storefront_url)) || null;

  A.dashboard = async () => {
    const page = App.nav.push(`
      <div class="dash-top"><button class="back tap" data-back aria-label="Back" style="margin:0">${ui.icon('arrow-left')}</button>
        <div class="dash-t"><h1>Agent Dashboard</h1><small id="dBiz">Your store</small></div>
        <button class="round tap" id="dVisit" aria-label="Visit my website" style="background:var(--bg)" hidden>${ui.icon('external')}</button></div>
      <div class="tabstrip" id="dSeg"></div>
      <div class="page-body" id="dBody"></div>`);
    const body = $('#dBody', page), strip = $('#dSeg', page);
    let tab = 'overview', url = null, upgrade = false;
    const TABS = () => [['overview', 'Overview'], ['orders', 'Orders'], ['sales', 'Sales'], ['transactions', 'Transactions'], ['store', 'Store'], ...(upgrade ? [['upgrade', 'Upgrade']] : []), ['withdrawals', 'Withdraw'], ['security', 'Security']];
    const drawTabs = () => {
      strip.innerHTML = TABS().map(([k, t]) => `<button class="tap${k === tab ? ' on' : ''}" data-t="${k}" data-quiet="1">${t}</button>`).join('');
      const on = $('.on', strip); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    };
    const go = (t) => {
      tab = t; drawTabs();
      body.innerHTML = ui.skel(4); body.scrollTop = 0;
      V[t](body, url);
    };
    strip.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b && b.dataset.t !== tab) { App.native.haptic('light'); go(b.dataset.t); } });
    page._stepBack = null;
    page.goTab = go;

    App.api('/agent/onboarding/status').then((r) => {
      if (!r.ok) return;
      A.status = r.data; url = storeUrl(r.data);
      if (r.data.business_name) $('#dBiz', page).textContent = r.data.business_name;
      if (url) { const v = $('#dVisit', page); v.hidden = false; v.dataset.url = url; }
      if (tab === 'overview') V.overview(body, url);
    });
    App.api('/agent/plan/upgrades').then((r) => { if (r.ok && (r.data.options || []).length) { upgrade = true; A.upgrades = r.data; drawTabs(); } });
    go('overview');
  };

  const V = {
    /* ---------------- Overview ---------------- */
    async overview(body, url) {
      const [sum, wal, tx] = await Promise.all([App.api('/agent/dashboard-summary'), App.api('/agent/wallet'), App.api('/agent/wallet/transactions', { query: { per_page: 8 } })]);
      if (!sum.ok) { body.innerHTML = ui.empty('wifi-off', 'Could not load your dashboard', sum.error, '<button class="btn btn-tonal btn-sm tap" id="dRetry">Try again</button>'); $('#dRetry', body).addEventListener('click', () => { body.innerHTML = ui.skel(4); V.overview(body, url); }); return; }
      const s = sum.data; if (wal.ok) S.agentWallet = wal.data.data || wal.data;
      const bal = S.agentWallet ? S.agentWallet.balance : s.wallet_balance;
      const stats = [
        ['Sales this month', fmt.money(s.revenue_this_month), `${s.bundles_sold_this_month} bundles sold`],
        ['Commission this month', fmt.money(s.commission_this_month), `${fmt.money(s.commission_all_time)} all time`],
        ['Revenue all time', fmt.money(s.revenue_all_time), `${s.bundles_sold_all_time} bundles`],
        ['Store customers', String(s.store_customers_total), `${s.store_customers_this_month} this month`],
        ['Store sales', fmt.money(s.store_sales_all_time), `${s.store_orders_delivered} delivered`],
        ['Pending withdrawals', fmt.money(s.pending_withdrawals), 'Awaiting payout'],
      ];
      const rows = tx.ok ? (tx.data.data || []) : [];
      body.innerHTML = `<div class="stag">
        <section class="hero"><div class="hero-top"><div class="hero-row"><div><div class="hero-label">Agent wallet</div><div class="hero-amt">${fmt.money(bal)}</div><div class="hero-sub">Your top-up balance</div></div>
          <button class="chip tap" id="dTop">${ui.icon('plus')} Top up</button></div></div>
          <div class="hero-bar"><button class="tap" id="dBuy">${ui.icon('data')}Buy data</button><button class="tap" id="dWd">${ui.icon('wallet')}Withdraw</button>${url ? `<button class="tap" data-url="${esc(url)}">${ui.icon('external')}My website</button>` : `<button class="tap" data-tab="orders" id="dOrd">${ui.icon('receipt')}Orders</button>`}</div></section>
        <div class="stats">${stats.map(([l, v, sub]) => `<div class="stat"><small>${esc(l)}</small><b>${esc(v)}</b><span>${esc(sub)}</span></div>`).join('')}</div>
        <div class="banner" style="margin-top:-4px">${ui.icon('wallet')}<div><b>Customer wallet</b>${fmt.money(s.customer_wallet_balance)} from refunded orders</div></div>
        <section class="card"><div class="sec-head"><h3>Your sales</h3></div>
          <div class="segs mini" id="cSeg"><span class="ind"></span>${['daily', 'weekly', 'monthly', 'yearly'].map((p, i) => `<button class="${i ? '' : 'on'}" data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
          <div class="achart" id="aChart"></div></section>
        <section class="card"><div class="sec-head"><h3>Recent transactions</h3></div>
          ${rows.length ? rows.map((t) => `<div class="wtx"><span class="wic ${t.type === 'credit' ? 'cr' : 'dr'}">${ui.icon(t.type === 'credit' ? 'plus' : 'arrow-right')}</span><span class="tx-main"><b>${esc(t.description || fmt.label(t.type))}</b><small>${esc(fmt.date(t.created_at))}</small></span><span class="tx-end"><b class="${t.type === 'credit' ? 'pos' : ''}">${t.type === 'credit' ? '+' : '-'}${fmt.money(t.amount)}</b><small>${fmt.money(t.balance_after)}</small></span></div>`).join('') : ui.empty('wallet', 'No transactions yet', 'Top-ups, purchases and withdrawals show up here.')}</section>
        ${url ? `<button class="btn btn-tonal tap" data-url="${esc(url)}" style="margin-bottom:10px">${ui.icon('external')}Visit my website</button>` : ''}
      </div>`;
      $('#dTop', body).addEventListener('click', () => V.topup(body, url));
      $('#dBuy', body).addEventListener('click', () => { App.nav.closeAll(); App.openShop(); });
      $('#dWd', body).addEventListener('click', () => body.closest('.page').goTab('withdrawals'));
      const ord = $('#dOrd', body); if (ord) ord.addEventListener('click', () => App.nav.closeAll());

      const chart = $('#aChart', body);
      const draw = async (period) => {
        chart.classList.add('busy');
        const r = await App.api('/agent/dashboard-chart', { query: { period } });
        chart.classList.remove('busy');
        if (!r.ok) { chart.innerHTML = `<p class="note">${esc(r.error)}</p>`; return; }
        const d = r.data, top = niceMax(Math.max(0, ...d.revenue));
        chart.innerHTML = `<div class="plot">${[1, .5, 0].map((f) => `<div class="g" style="bottom:${f * 100}%"><span>${top * f >= 1000 ? (top * f / 1000) + 'k' : Math.round(top * f)}</span></div>`).join('')}
          <div class="cols">${d.labels.map((l, i) => `<div class="col" data-tip="${esc(l)} · ${fmt.money(d.revenue[i])} · ${d.orders[i]} order${d.orders[i] === 1 ? '' : 's'}"><div class="sbar" style="--h:${(d.revenue[i] / top) * 100}%;--i:${i}"></div>${d.labels.length <= 8 || i % 2 === 0 ? `<span>${esc(l.replace(/ \d{4}$/, ''))}</span>` : ''}</div>`).join('')}</div></div>`;
      };
      $('#cSeg', body).addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        $$('#cSeg button', body).forEach((x, i) => { x.classList.toggle('on', x === b); if (x === b) $('#cSeg .ind', body).style.transform = `translateX(${i * 100}%)`; });
        draw(b.dataset.p);
      });
      draw('daily');
    },

    topup(body, url) {
      const s = ui.sheet({});
      s.set(`<h3 class="sheet-title">Top up agent wallet</h3><p class="sheet-sub">Add money with Mobile Money or card. Between GH₵5 and GH₵5,000.</p>
        <div class="chips">${[20, 50, 100, 200].map((n) => `<button class="tap" data-amt="${n}">GH₵${n}</button>`).join('')}</div>
        ${A.field('tu-amt', 'Amount (GH₵)', A.input('tu-amt', 'type="number" inputmode="decimal" min="5" max="5000" step="0.01" placeholder="0.00"'))}
        <div id="tu-msg"></div><div class="btn-col"><button class="btn btn-primary tap" id="tu-go">Continue to payment</button></div>`);
      s.el.addEventListener('click', (e) => { const c = e.target.closest('[data-amt]'); if (c) $('#tu-amt', s.el).value = c.dataset.amt; });
      $('#tu-go', s.el).addEventListener('click', async (e) => {
        const b = e.currentTarget, amt = Number($('#tu-amt', s.el).value), m = $('#tu-msg', s.el);
        if (!(amt >= 5 && amt <= 5000)) { m.innerHTML = '<div class="err-msg">Enter an amount between GH₵5 and GH₵5,000.</div>'; return; }
        const gw = await App.pickGateway(amt);
        if (gw === undefined) return;                                   // cancelled
        const before = S.agentWallet ? Number(S.agentWallet.balance) : 0;
        ui.busy(b, true, 'Starting payment');
        const r = await App.api('/agent/wallet/topup', { method: 'POST', body: Object.assign({ amount: amt }, gw ? { gateway: gw } : {}) });
        ui.busy(b, false);
        if (!r.ok) { m.innerHTML = `<div class="err-msg">${esc(r.error)}</div>`; return; }
        let ref = r.data.reference || null;
        if (!ref) { try { ref = new URL(r.data.authorization_url).searchParams.get('transaction_reference'); } catch (_) {} }
        s.persistent = false; s.close();
        const sheet = ui.sheet({ onClose: () => { body.innerHTML = ui.skel(4); V.overview(body, url); App.refreshData(); } });
        App.pay.track(sheet, {
          url: r.data.authorization_url, waitTitle: 'Top up your wallet',
          summary: `<div class="sum"><div class="tot"><span>Amount</span><b>${fmt.money(amt)}</b></div></div>`,
          results: { ok: ['Wallet topped up', `${fmt.money(amt)} was added to your agent wallet.`], err: ['Top-up failed', 'Your wallet was not charged. You can try again.'] },
          onReturnUrl(u) { const x = new URL(u).searchParams.get('reference'); if (x) ref = x; },
          async check() {
            if (ref) { const c = await App.api(`/payments/confirm/${encodeURIComponent(ref)}`); if (c.ok) { const st = App.pay.confirmState(c.data.status); if (st !== 'pending') return { state: st }; } }
            // No reference: the wallet balance goes up once the payment is confirmed on the server.
            const w = await App.api('/agent/wallet');
            if (!w.ok) return null;
            const bal = Number((w.data.data || w.data).balance);
            return { state: bal + 0.001 >= before + amt ? 'ok' : 'pending' };
          },
        });
      });
    },


    /* ---------------- Orders: received from the store / my own purchases ---------------- */
    async orders(body) {
      let mode = 'received', status = '', page = 1, rows = [], total = 0;
      body.innerHTML = `<div class="segs two" id="oSeg"><span class="ind"></span><button class="on" data-m="received">Received</button><button data-m="mine">My purchases</button></div>
        <div id="oFilter" class="fchips"></div><div id="oList"></div><div id="oMore"></div>`;
      const list = $('#oList', body), more = $('#oMore', body), filt = $('#oFilter', body);
      const STATUSES = [['', 'All'], ['delivered', 'Delivered'], ['processing', 'Processing'], ['pending_payment', 'Awaiting payment'], ['failed', 'Failed']];
      const rowHtml = (o, i) => {
        const m = App.netMeta(o.network);
        return `<div class="tx" style="--i:${i % 12};cursor:default"><span class="net" style="background:${m.bg};color:${m.fg}">${esc(m.tag)}</span>
          <span class="tx-main"><b>${esc(o.bundle_size)} · ${esc(o.recipient_number)}</b><small>${mode === 'received' ? esc(o.buyer || 'Customer') + ' · ' : ''}${esc(fmt.date(o.created_at))}</small></span>
          <span class="tx-end"><b>${fmt.money(o.amount)}</b>${mode === 'received' && o.profit ? `<small class="pos">+${fmt.money(o.profit)} profit</small>` : ''}${ui.status(o.status)}</span></div>`;
      };
      const draw = () => { list.innerHTML = rows.length ? `<section class="card" style="padding:6px 14px">${rows.map(rowHtml).join('')}</section>` : ui.empty('receipt', 'No orders yet', mode === 'received' ? 'Orders bought on your store show up here.' : 'Data you buy as an agent shows up here.'); more.innerHTML = rows.length < total ? '<button class="btn btn-tonal tap" id="oMoreBtn">Load more</button>' : ''; };
      const load = async (reset) => {
        if (reset) { page = 1; rows = []; list.innerHTML = ui.skel(4); }
        const r = mode === 'received'
          ? await App.api('/agent/store-orders', { query: { page, per_page: 25, status } })
          : await App.api('/agent/orders', { query: { page, per_page: 25 } });
        if (!r.ok) { list.innerHTML = ui.empty('wifi-off', 'Could not load orders', r.error); return; }
        const d = r.data;
        const got = (d.data || []).map((o) => (mode === 'received' ? o : { id: o.id, created_at: o.created_at, network: o.network, bundle_size: o.bundle_size, recipient_number: o.recipient_number, amount: o.amount, status: o.status }));
        rows = rows.concat(got); total = d.total != null ? d.total : d.meta ? d.meta.total : rows.length;
        draw();
      };
      const drawFilter = () => { filt.innerHTML = mode === 'received' ? STATUSES.map(([k, t]) => `<button class="tap${k === status ? ' on' : ''}" data-s="${k}" data-quiet="1">${t}</button>`).join('') : ''; };
      $('#oSeg', body).addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === mode) return;
        mode = b.dataset.m; status = ''; $$('#oSeg button', body).forEach((x, i) => { x.classList.toggle('on', x === b); if (x === b) $('#oSeg .ind', body).style.transform = `translateX(${i * 100}%)`; });
        drawFilter(); load(true);
      });
      filt.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; status = b.dataset.s; drawFilter(); load(true); });
      more.addEventListener('click', async (e) => { const b = e.target.closest('#oMoreBtn'); if (!b) return; ui.busy(b, true); page++; await load(false); });
      drawFilter(); load(true);
    },

    /* ---------------- Sales ---------------- */
    async sales(body) {
      const sal = await App.api('/agent/sales');
      if (!sal.ok) { body.innerHTML = ui.empty('wifi-off', 'Could not load sales', sal.error); return; }
      const d = sal.data;
      const P = [['Today', d.today], ['This week', d.week], ['This month', d.month], ['All time', d.all_time]];
      body.innerHTML = `<div class="stag">
        <div class="stats">${P.map(([l, p]) => `<div class="stat"><small>${l}</small><b>${fmt.money(p.revenue)}</b><span>${p.orders} order${p.orders === 1 ? '' : 's'} · ${fmt.money(p.profit)} profit</span></div>`).join('')}</div>
        <div class="stats three"><div class="stat"><small>Awaiting payment</small><b>${d.awaiting_payment}</b></div><div class="stat"><small>Being delivered</small><b>${d.in_progress}</b></div><div class="stat"><small>Failed</small><b>${d.failed}</b></div></div>
        <section class="card"><div class="sec-head"><h3>Store sales</h3></div>
          <div class="segs mini" id="sSeg"><span class="ind"></span>${['daily', 'weekly', 'monthly', 'yearly'].map((p, i) => `<button class="${i ? '' : 'on'}" data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
          <div class="achart" id="sChart"></div></section>
        <section class="card"><div class="sec-head"><h3>Sales by network</h3></div>
          ${(d.by_network || []).length ? d.by_network.map((n) => { const m = App.netMeta(n.network); return `<div class="wtx"><span class="net" style="background:${m.bg};color:${m.fg};width:40px;height:40px;font-size:11px">${esc(m.tag)}</span><span class="tx-main"><b>${esc(n.network)}</b><small>${n.orders} order${n.orders === 1 ? '' : 's'}</small></span><span class="tx-end"><b>${fmt.money(n.revenue)}</b></span></div>`; }).join('') : ui.empty('data', 'No sales yet', 'Your store sales by network will show here.')}</section></div>`;
      const chart = $('#sChart', body);
      const draw = async (period) => {
        chart.classList.add('busy');
        const c = await App.api('/agent/store-sales-chart', { query: { period } });
        chart.classList.remove('busy');
        if (!c.ok) { chart.innerHTML = `<p class="note">${esc(c.error)}</p>`; return; }
        V.chart(chart, c.data);
      };
      $('#sSeg', body).addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        $$('#sSeg button', body).forEach((x, i) => { x.classList.toggle('on', x === b); if (x === b) $('#sSeg .ind', body).style.transform = `translateX(${i * 100}%)`; });
        draw(b.dataset.p);
      });
      draw('daily');
    },

    chart(el, d) {
      const top = niceMax(Math.max(0, ...d.revenue));
      el.innerHTML = `<div class="plot">${[1, .5, 0].map((f) => `<div class="g" style="bottom:${f * 100}%"><span>${top * f >= 1000 ? (top * f / 1000) + 'k' : Math.round(top * f)}</span></div>`).join('')}
        <div class="cols">${d.labels.map((l, i) => `<div class="col" data-tip="${esc(l)} · ${fmt.money(d.revenue[i])} · ${d.orders[i]} order${d.orders[i] === 1 ? '' : 's'}"><div class="sbar" style="--h:${(d.revenue[i] / top) * 100}%;--i:${i}"></div>${d.labels.length <= 8 || i % 2 === 0 ? `<span>${esc(l.replace(/ \d{4}$/, ''))}</span>` : ''}</div>`).join('')}</div></div>`;
    },

    /* ---------------- Transactions: the whole wallet history ---------------- */
    async transactions(body) {
      let page = 1, rows = [], last = 1;
      body.innerHTML = '<div id="tList"></div><div id="tMore"></div>';
      const list = $('#tList', body), more = $('#tMore', body);
      const load = async () => {
        const r = await App.api('/agent/wallet/transactions', { query: { page, per_page: 25 } });
        if (!r.ok) { list.innerHTML = ui.empty('wifi-off', 'Could not load transactions', r.error); return; }
        rows = rows.concat(r.data.data || []); last = r.data.meta ? r.data.meta.last_page : 1;
        list.innerHTML = rows.length ? `<section class="card" style="padding:6px 14px">${rows.map((t) => `<div class="wtx"><span class="wic ${t.type === 'credit' ? 'cr' : 'dr'}">${ui.icon(t.type === 'credit' ? 'plus' : 'arrow-right')}</span><span class="tx-main"><b>${esc(t.description || fmt.label(t.type))}</b><small>${esc(fmt.date(t.created_at))}</small></span><span class="tx-end"><b class="${t.type === 'credit' ? 'pos' : ''}">${t.type === 'credit' ? '+' : '-'}${fmt.money(t.amount)}</b><small>${fmt.money(t.balance_after)}</small></span></div>`).join('')}</section>` : ui.empty('wallet', 'No transactions yet', 'Top-ups, purchases and withdrawals show up here.');
        more.innerHTML = page < last ? '<button class="btn btn-tonal tap" id="tMoreBtn">Load more</button>' : '';
      };
      more.addEventListener('click', async (e) => { const b = e.target.closest('#tMoreBtn'); if (!b) return; ui.busy(b, true); page++; await load(); });
      load();
    },

    /* ---------------- Plan upgrade ---------------- */
    async upgrade(body) {
      const r = await App.api('/agent/plan/upgrades');
      if (!r.ok) { body.innerHTML = ui.empty('wifi-off', 'Could not load', r.error); return; }
      const { current, options } = r.data;
      if (!(options || []).length) { body.innerHTML = ui.empty('check', 'You are on the top plan', 'There is nothing higher to upgrade to.'); return; }
      body.innerHTML = `<div class="stag"><div class="banner" style="margin-bottom:14px">${ui.icon('briefcase')}<div><b>Current plan: ${esc(current.name)}</b>Upgrade and you only pay the difference.</div></div>
        ${options.map((p) => `<div class="plan${p.key === 'website_app' ? ' pop' : ''}"><div class="plan-top"><b>${esc(p.name)}</b><span>${fmt.money(p.upgrade_price)}</span></div>
          <p class="note" style="margin:-6px 0 10px">Upgrade price (full plan ${fmt.money(p.price)})</p>
          <ul>${p.features.map((f) => `<li>${ui.icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
          <button class="btn btn-primary tap" data-up="${esc(p.key)}">Upgrade to ${esc(p.name)}</button></div>`).join('')}</div>`;
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-up]'); if (!b) return;
        const plan = options.find((x) => x.key === b.dataset.up);
        const gw = await App.pickGateway(plan.upgrade_price);
        if (gw === undefined) return;
        ui.busy(b, true, 'Starting payment');
        const x = await App.api('/agent/plan/upgrade', { method: 'POST', body: Object.assign({ plan: plan.key }, gw ? { gateway: gw } : {}) });
        ui.busy(b, false);
        if (!x.ok) return ui.toast(x.error, 'err');
        let ref = x.data.reference || null;
        if (!ref) { try { ref = new URL(x.data.authorization_url).searchParams.get('transaction_reference'); } catch (_) {} }
        const sheet = ui.sheet({ onClose: () => { App.refreshData(); body.innerHTML = ui.skel(3); V.upgrade(body); } });
        App.pay.track(sheet, {
          url: x.data.authorization_url, waitTitle: 'Pay for your upgrade',
          summary: `<div class="sum"><div><span>Upgrade to</span><b>${esc(plan.name)}</b></div><div class="tot"><span>Amount</span><b>${fmt.money(plan.upgrade_price)}</b></div></div>`,
          results: { ok: ['Plan upgraded', `You are now on the ${plan.name} plan.`], err: ['Payment failed', 'Your plan was not changed. You can try again.'] },
          onReturnUrl(u) { const q = new URL(u).searchParams.get('reference'); if (q) ref = q; },
          async check() {
            if (ref) { const c = await App.api(`/payments/confirm/${encodeURIComponent(ref)}`); if (c.ok) { const st = App.pay.confirmState(c.data.status); if (st !== 'pending') return { state: st }; } }
            const u = await App.api('/agent/plan/upgrades');
            return u.ok ? { state: u.data.current && u.data.current.key === plan.key ? 'ok' : 'pending' } : null;
          },
        });
      });
    },

    /* ---------------- Store settings ---------------- */
    async store(body, url) {
      const r = await App.api('/agent/store-settings');
      if (!r.ok) { body.innerHTML = ui.empty('wifi-off', 'Could not load', r.error); return; }
      const d = r.data, files = {};
      const v = (x) => esc(x == null ? '' : x);
      const up = (id, label, cur, hint) => `<div class="field"><span>${label}</span><div class="upl"><img id="${id}-p" src="${v(cur)}" ${cur ? '' : 'hidden'} alt="" /><div class="upl-ph" id="${id}-h" ${cur ? 'hidden' : ''}>${ui.icon('plus')}</div>
        <button type="button" class="btn btn-tonal btn-sm tap" data-pick="${id}">Change</button><input id="${id}" type="file" accept="image/*" hidden /></div><small class="hint">${hint}</small></div>`;
      body.innerHTML = `<div class="stag">
        <section class="card"><div class="sec-head"><h3>1. Your brand</h3></div>
          ${A.field('s-name', 'Business name', A.input('s-name', `maxlength="80" value="${v(d.business_name)}"`))}
          ${up('s-logo', 'Business logo', d.logo_url, 'Leave as it is to keep your current logo.')}
          <div class="field"><span>Brand color</span><div class="colorrow"><input type="color" id="s-col" value="${v(d.brand_primary_color || '#e7e7e7')}" /><div class="inp" style="flex:1"><input id="s-hex" maxlength="7" value="${v(d.brand_primary_color || '#e7e7e7')}" /></div></div><small class="hint">Colors the buttons and header of your storefront.</small></div>
          ${up('s-hero', 'Homepage hero image', d.hero_image_url, 'Shown on your storefront homepage.')}
          ${up('s-auth', 'Login / register page image', d.auth_image_url, 'Falls back to your hero image if empty.')}</section>
        <section class="card"><div class="sec-head"><h3>2. Payout &amp; location</h3></div>
          ${A.field('s-reg', 'Region', A.select('s-reg', A.REGIONS, d.region, 'Select region'))}
          ${d.includes_custom_domain ? A.field('s-dom', 'Custom domain', A.input('s-dom', `maxlength="120" autocapitalize="none" placeholder="yourbrand.com" value="${v(d.custom_domain)}"`)) : ''}
          ${A.field('s-net', 'Mobile Money network', A.select('s-net', A.MOMO, d.momo_network, 'Select network'))}
          ${A.field('s-num', 'Mobile Money number', A.input('s-num', `type="tel" inputmode="numeric" maxlength="10" value="${v(d.momo_number)}"`))}</section>
        <section class="card"><div class="sec-head"><h3>3. Contact &amp; social</h3></div><p class="note" style="margin-top:-4px">Shown on your storefront. All optional.</p>
          ${A.field('s-phone', 'Support phone', A.input('s-phone', `type="tel" inputmode="numeric" maxlength="10" placeholder="0240000000" value="${v(d.support_phone)}"`))}
          ${A.field('s-wa', 'WhatsApp number', A.input('s-wa', `type="tel" inputmode="numeric" maxlength="10" placeholder="0240000000" value="${v(d.whatsapp_number)}"`))}
          ${A.field('s-mail', 'Support email', A.input('s-mail', `type="email" maxlength="120" placeholder="support@yourstore.com" value="${v(d.support_email)}"`))}
          ${[['facebook', 'Facebook URL'], ['instagram', 'Instagram URL'], ['x', 'X (Twitter) URL'], ['tiktok', 'TikTok URL'], ['linkedin', 'LinkedIn URL']].map(([k, l]) => A.field('s-' + k, l, A.input('s-' + k, `type="url" inputmode="url" autocapitalize="none" maxlength="255" placeholder="https://" value="${v(d['social_' + k])}"`))).join('')}</section>
        <section class="card"><div class="sec-head"><h3>4. Store wording</h3></div><p class="note" style="margin-top:-4px">Already written for you. Change only if you want your own words.</p>
          ${A.field('s-tag', 'Store tagline', A.input('s-tag', `maxlength="150" placeholder="e.g. Fast, reliable data bundles" value="${v(d.store_tagline)}"`))}
          ${A.field('s-meta', 'Meta description', A.input('s-meta', `maxlength="160" value="${v(d.brand_description)}"`), 'Used by search engines and link previews.')}</section>
        ${d.includes_app ? `<p class="note">Your plan includes a mobile app. Saving rebuilds it with your new branding.</p>` : ''}
        <div id="s-err">${d.next_save_in > 0 ? `<div class="banner">${ui.icon('clock')}<div><b>Saved recently</b>You can save again in ${Math.ceil(d.next_save_in / 60)} min.</div></div>` : ''}</div><div class="btn-col"><button class="btn btn-primary tap" id="s-save">Save store settings</button></div></div>`;

      App.digits(body, '#s-num, #s-phone, #s-wa');
      body.addEventListener('click', (e) => { const p = e.target.closest('[data-pick]'); if (p) $('#' + p.dataset.pick, body).click(); });
      $$('input[type=file]', body).forEach((inp) => inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        try { files[inp.id] = await App.img.prepare(f, inp.id === 's-logo' ? 800 : 1600); } catch (x) { return ui.toast(x.message, 'err'); }
        const im = $('#' + inp.id + '-p', body); im.src = URL.createObjectURL(files[inp.id]); im.hidden = false; $('#' + inp.id + '-h', body).hidden = true;
      }));
      const col = $('#s-col', body), hex = $('#s-hex', body);
      col.addEventListener('input', () => { hex.value = col.value; });
      hex.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) col.value = hex.value; });

      $('#s-save', body).addEventListener('click', async (e) => {
        const b = e.currentTarget, g = (id) => ($('#' + id, body) ? $('#' + id, body).value.trim() : ''), err = $('#s-err', body);
        const bad = (t) => { err.innerHTML = `<div class="err-msg">${esc(t)}</div>`; App.native.haptic('error'); };
        err.innerHTML = '';
        if (!g('s-name')) return bad('Enter your business name.');
        if (!g('s-reg') || !g('s-net') || !/^\d{10}$/.test(g('s-num'))) return bad('Region, Mobile Money network and a 10-digit Mobile Money number are required.');
        if ((g('s-phone') && !/^\d{10}$/.test(g('s-phone'))) || (g('s-wa') && !/^\d{10}$/.test(g('s-wa')))) return bad('Support phone and WhatsApp numbers must be exactly 10 digits.');
        if (g('s-hex') && !/^#[0-9a-fA-F]{6}$/.test(g('s-hex'))) return bad('Brand color must look like #1A2B3C.');
        const f = new FormData();
        const put = (k, val) => f.append(k, val);
        put('business_name', g('s-name')); put('store_tagline', g('s-tag')); put('brand_description', g('s-meta'));
        put('region', g('s-reg')); put('momo_network', g('s-net')); put('momo_number', g('s-num'));
        if (d.includes_custom_domain) put('custom_domain', g('s-dom'));
        if (g('s-hex')) put('brand_primary_color', g('s-hex'));
        put('support_phone', g('s-phone')); put('whatsapp_number', g('s-wa')); put('support_email', g('s-mail'));
        ['facebook', 'instagram', 'x', 'tiktok', 'linkedin'].forEach((k) => put('social_' + k, g('s-' + k)));
        if (files['s-logo']) f.append('business_logo', files['s-logo'], 'logo.jpg');
        if (files['s-hero']) f.append('hero_image', files['s-hero'], 'hero.jpg');
        if (files['s-auth']) f.append('auth_image', files['s-auth'], 'auth.jpg');
        ui.busy(b, true, 'Saving');
        const x = await App.api('/agent/store-settings', { method: 'POST', form: f });
        ui.busy(b, false);
        if (!x.ok) return bad(x.code === 'store_settings_cooldown' && x.data && x.data.retry_after ? `${x.error} (try again in ${Math.ceil(x.data.retry_after / 60)} min)` : x.error);
        ui.toast(x.data && x.data.app_rebuild === 'started' ? 'Saved. Your mobile app is rebuilding with the new branding.' : 'Store settings saved', 'ok'); App.native.haptic('success');
        $('#dBiz', body.closest('.page')).textContent = g('s-name');
      });
    },

    /* ---------------- Withdrawals ---------------- */
    async withdrawals(body, url) {
      const [wal, list, st] = await Promise.all([App.api('/agent/wallet'), App.api('/agent/withdrawals'), App.api('/agent/store-settings')]);
      const bal = wal.ok ? (wal.data.data || wal.data).balance : 0, rows = list.ok ? list.data.data || [] : [], set = st.ok ? st.data : {};
      body.innerHTML = `<div class="stag"><section class="card"><div class="sec-head"><h3>Request a withdrawal</h3></div>
        <p class="note" style="margin-top:-4px">Available: <b>${fmt.money(bal)}</b>. Minimum GH₵20.</p>
        ${A.field('w-amt', 'Amount (GH₵)', A.input('w-amt', 'type="number" inputmode="decimal" min="20" step="0.01" placeholder="0.00"'))}
        ${A.field('w-net', 'Mobile Money network', A.select('w-net', A.MOMO, set.momo_network, 'Select network'))}
        ${A.field('w-num', 'Mobile Money number', A.input('w-num', `type="tel" inputmode="numeric" maxlength="10" value="${esc(set.momo_number || '')}"`))}
        <div id="w-msg"></div><div class="btn-col"><button class="btn btn-primary tap" id="w-go">Request withdrawal</button></div></section>
        <section class="card"><div class="sec-head"><h3>Withdrawal history</h3></div>
        ${rows.length ? rows.map((w) => `<div class="wtx"><span class="wic dr">${ui.icon('wallet')}</span><span class="tx-main"><b>${fmt.money(w.amount)}</b><small>${esc(w.momo_network)} · ${esc(w.momo_number)} · ${esc(fmt.date(w.created_at))}${w.admin_note ? ' · ' + esc(w.admin_note) : ''}</small></span><span class="tx-end">${ui.pill(fmt.label(w.status), w.status === 'paid' ? 'ok' : w.status === 'rejected' ? 'err' : 'warn')}</span></div>`).join('') : ui.empty('wallet', 'No withdrawals yet', 'Your payout requests will show up here.')}</section></div>`;
      App.digits(body, '#w-num');
      $('#w-go', body).addEventListener('click', async (e) => {
        const b = e.currentTarget, m = $('#w-msg', body), amt = Number($('#w-amt', body).value), net = $('#w-net', body).value, num = $('#w-num', body).value.trim();
        const bad = (t) => { m.innerHTML = `<div class="err-msg">${esc(t)}</div>`; App.native.haptic('error'); };
        m.innerHTML = '';
        if (!(amt >= 20)) return bad('The minimum withdrawal is GH₵20.');
        if (amt > bal) return bad('That is more than your agent wallet balance.');
        if (!net || !/^\d{10}$/.test(num)) return bad('Choose your network and enter a 10-digit Mobile Money number.');
        ui.busy(b, true, 'Submitting');
        const r = await App.api('/agent/withdrawals', { method: 'POST', body: { amount: amt, momo_network: net, momo_number: num } });
        ui.busy(b, false);
        if (!r.ok) { if (r.code === 'pin_required') { if (await App.agentPin()) b.click(); return; } return bad(r.error); }
        ui.toast('Withdrawal requested', 'ok'); App.native.haptic('success'); App.refreshData();
        body.innerHTML = ui.skel(4); V.withdrawals(body, url);
      });
    },

    /* ---------------- Security: transaction PIN ---------------- */
    security(body) {
      const has = !!(S.user && S.user.has_transaction_pin);
      body.innerHTML = `<div class="stag"><section class="card"><div class="sec-head"><h3>Transaction PIN</h3></div>
        <div class="banner" style="margin-bottom:6px">${ui.icon(has ? 'shield' : 'lock')}<div><b>${has ? 'PIN is set' : 'No PIN yet'}</b>${has ? 'You can change it below.' : 'Set a 4-digit PIN to buy as an agent and withdraw.'}</div></div>
        ${A.field('t-pw', 'Account password', A.input('t-pw', 'type="password" autocomplete="current-password"'))}
        ${A.field('t-pin', has ? 'New 4-digit PIN' : '4-digit PIN', A.input('t-pin', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off"'))}
        ${A.field('t-pin2', 'Confirm PIN', A.input('t-pin2', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off"'))}
        <div id="t-msg"></div><div class="btn-col"><button class="btn btn-primary tap" id="t-go">${has ? 'Change PIN' : 'Set PIN'}</button></div></section></div>`;
      $('#t-go', body).addEventListener('click', async (e) => {
        const b = e.currentTarget, m = $('#t-msg', body), pw = $('#t-pw', body).value, pin = $('#t-pin', body).value, pin2 = $('#t-pin2', body).value;
        const bad = (t) => { m.innerHTML = `<div class="err-msg">${esc(t)}</div>`; };
        if (!pw) return bad('Enter your account password.');
        if (!/^\d{4}$/.test(pin)) return bad('Your PIN must be exactly 4 digits.');
        if (pin !== pin2) return bad('The two PINs do not match.');
        ui.busy(b, true, 'Saving');
        const r = await App.api('/account/transaction-pin', { method: 'POST', body: { current_password: pw, pin, pin_confirmation: pin2 } });
        ui.busy(b, false);
        if (!r.ok) return bad(r.error);
        if (S.user) { S.user.has_transaction_pin = true; App.store.set('user', S.user); }
        ui.toast('Transaction PIN saved', 'ok'); App.native.haptic('success'); V.security(body);
      });
    },
  };
})();
