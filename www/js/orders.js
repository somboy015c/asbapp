/* Orders tab: account orders when logged in, otherwise the orders kept on this phone. */
(() => {
  'use strict';
  const { $, esc } = App;
  const ui = App.ui, fmt = App.fmt, S = App.state;
  const FINAL = ['delivered', 'failed', 'refunded'];

  const items = () => (App.session.loggedIn ? S.orders : App.guestOrders.list());

  const listHtml = () => {
    const list = items();
    if (list === null) return ui.skel(5);
    if (!list.length) return ui.empty('receipt', 'No orders yet', 'Buy a data bundle and it will show up here.', `<button class="btn btn-primary btn-sm tap" data-tab="shop">Buy data</button>`);
    return list.map((o, i) => ui.orderRow(o, i)).join('');
  };

  App.screens.orders = {
    render() {
      const logged = App.session.loggedIn;
      const guestNote = !logged ? `<div class="banner">${ui.icon('info')}<div><b>Orders on this phone</b>Log in to keep your orders on every device.</div><button class="tap" data-act="login">Log in</button></div>` : '';
      const body = listHtml();
      return `<div class="stag"><h1 class="page-title">Orders</h1><p class="page-sub">Track your data purchases.</p>${guestNote}<section class="card" id="orderList" style="padding:8px 14px">${body}</section></div>`;
    },
    async mount() {
      if (App.session.loggedIn) {
        const r = await App.api('/orders', { query: { per_page: 30 } });
        if (r.ok) { S.orders = r.data.data; this.paint(); }
      } else {
        // quietly refresh the status of orders that were still in progress
        const open = App.guestOrders.list().filter((o) => !FINAL.includes(o.status)).slice(0, 5);
        let changed = false;
        for (const o of open) {
          const r = await App.api(`/orders/guest/verify/${encodeURIComponent(o.ref)}`, { auth: false });
          const ord = r.ok && r.data.order;
          if (ord && ord.status !== o.status) { o.status = ord.status; App.guestOrders.upsert(o); changed = true; }
        }
        if (changed) this.paint();
      }
    },
    paint() { const el = $('#orderList'); if (el) el.innerHTML = listHtml(); App.markStale('home'); },
    open(key) {
      const o = (items() || []).find((x) => String(x.ref || x.id) === String(key));
      if (!o) return;
      const size = o.size || o.bundle_size, number = o.number || o.recipient_number, when = o.at || o.created_at;
      const kind = o.status === 'delivered' ? 'ok' : o.status === 'failed' || o.status === 'refunded' ? 'err' : 'warn';
      const sheet = ui.sheet({});
      const ref = String(o.ref || o.id);
      const msg = encodeURIComponent(`Hello ASBData, I need help with my order ${ref.slice(0, 8)} (${size} ${o.network} to ${number}).`);
      sheet.set(`<div class="res"><div class="res-ic ${kind}">${ui.icon(kind === 'ok' ? 'check' : kind === 'err' ? 'x' : 'clock')}</div><h3>${esc(size)} ${esc(o.network)}</h3><p>${ui.status(o.status)}</p></div>
        <div class="sum"><div><span>Recipient</span><b>${esc(number)}</b></div><div><span>Amount</span><b>${fmt.money(o.amount)}</b></div><div><span>Date</span><b>${esc(fmt.date(when))}</b></div><div><span>Reference</span><b>${esc(ref.slice(0, 8))}</b></div></div>
        <div class="btn-col"><button class="btn btn-tonal tap" data-url="https://wa.me/${App.cfg.WHATSAPP}?text=${msg}">${ui.icon('whatsapp')}Get help on WhatsApp</button><button class="btn btn-outline tap" id="oc">Close</button></div>`);
      $('#oc', sheet.el).addEventListener('click', () => sheet.close());
    },
  };
})();
