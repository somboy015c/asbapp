/* One payment tracker for everything: data orders, agent plans, wallet top-ups.
   The payment page opens INSIDE the app, then we confirm with the server and show the result. */
(() => {
  'use strict';
  const { $, esc, sleep } = App;
  const ui = App.ui;
  const P = (window.Capacitor && window.Capacitor.Plugins) || {};

  /* opts: { url, check(): {state:'ok'|'err'|'pending'|'proc'}|null, waitTitle, waitText, summary (html),
             ok:[title,text], err:[title,text], warn:[title,text], proc:[title,text], onDone(state) } */
  App.pay = {
    track(sheet, o) {
      sheet.persistent = true;
      const results = Object.assign({
        ok: ['Payment successful', 'Thank you. Your payment was received.'],
        err: ['Payment failed', 'Something went wrong. If you were charged, you will be refunded or can contact support.'],
        warn: ['Payment not completed', 'We have not received your payment yet. If you already paid, wait a minute and check again.'],
        proc: ['Still processing', 'Your payment was received and is being processed. This can take a few minutes.'],
      }, o.results || {});

      let done = false, closedAt = null, notPaid = 0, busy = false, win = null;

      const waitView = (text) => sheet.set(`<div class="res"><div class="wait-ring"></div><h3>${esc(o.waitTitle || 'Complete your payment')}</h3><p>${esc(text)}</p></div>
        ${o.url ? `<div class="btn-col"><button class="btn btn-primary tap" id="chk">I have paid, check status</button><button class="btn btn-outline tap" id="reopen">Open payment page again</button></div>` : ''}`);

      const finish = (state) => {
        if (done) return; done = true;
        if (win) win.close();
        sheet.persistent = false;
        const [title, text] = results[state];
        const icon = { ok: 'check', err: 'x', warn: 'clock', proc: 'clock' }[state];
        const tone = state === 'ok' ? 'ok' : state === 'err' ? 'err' : 'warn';
        App.native.haptic(state === 'ok' ? 'success' : 'error');
        sheet.set(`<div class="res"><div class="res-ic ${tone}">${ui.icon(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${o.summary || ''}</div>
          <div class="btn-col">${state === 'warn' ? '<button class="btn btn-primary tap" id="again">Check again</button>' : ''}<button class="btn ${state === 'warn' ? 'btn-outline' : 'btn-primary'} tap" id="done">Done</button></div>`);
        $('#done', sheet.el).addEventListener('click', () => sheet.close());
        const again = $('#again', sheet.el);
        if (again) again.addEventListener('click', () => { done = false; sheet.persistent = true; closedAt = Date.now(); notPaid = 0; waitView('Checking your payment…'); wire(); loop(); });
        o.onDone && o.onDone(state);
      };

      const check = async () => {
        if (busy || done) return; busy = true;
        let r = null;
        try { r = await o.check(); } catch (_) {}
        busy = false;
        if (!r || done) return;
        if (r.state === 'ok') return finish('ok');
        if (r.state === 'err') return finish('err');
        if (r.state === 'pending') { if (closedAt && Date.now() - closedAt > 4000) { notPaid++; if (notPaid >= 3) finish('warn'); } }
        else if (r.state === 'proc' && closedAt && Date.now() - closedAt > 45000) finish('proc');
      };
      const loop = async () => { for (let i = 0; i < 100 && !done; i++) { await check(); await sleep(3000); } if (!done) finish('proc'); };

      const wire = () => {
        const chk = $('#chk', sheet.el), re = $('#reopen', sheet.el);
        if (chk) chk.addEventListener('click', async () => { ui.busy(chk, true, 'Checking'); closedAt = closedAt || Date.now() - 5000; await check(); ui.busy(chk, false); if (!done) ui.toast('No payment yet. Finish paying, then check again.'); });
        if (re) re.addEventListener('click', async () => { win = await App.native.openPayment(o.url, evt); });
      };
      const evt = { onReturn: () => { closedAt = Date.now(); check(); }, onClose: () => { closedAt = Date.now(); check(); } };

      waitView(o.waitText || (o.url ? 'The secure payment page is open. Pay with Mobile Money or card, then you will come straight back here.' : 'Please wait…'));
      wire();
      const subs = [];
      if (P.App) P.App.addListener('appStateChange', (s) => { if (s.isActive) check(); }).then((x) => subs.push(x)).catch(() => {});
      const origDone = o.onDone; o.onDone = (st) => { subs.forEach((x) => { try { x.remove(); } catch (_) {} }); origDone && origDone(st); };
      (async () => { if (o.url) win = await App.native.openPayment(o.url, evt); loop(); })();
    },
  };
  // order status -> tracker state
  App.pay.orderState = (status) => (status === 'delivered' ? 'ok' : status === 'failed' || status === 'refunded' ? 'err' : status === 'pending_payment' ? 'pending' : 'proc');
  // payment-confirm status -> tracker state
  App.pay.confirmState = (status) => (status === 'success' ? 'ok' : status === 'failed' ? 'err' : 'pending');
})();
