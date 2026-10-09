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

      let notified = false;
      const gwButtons = () => {
        const list = o.gateways || [];
        return (list.length ? list : [{ key: null, label: '' }]).map((g) => `<button class="btn btn-primary tap" data-resume="${esc(g.key || '')}">${list.length > 1 ? 'Pay with ' + esc(g.label) : 'Complete payment'}</button>`).join('');
      };
      const finish = (state) => {
        if (done) return; done = true;
        if (win) win.close();
        sheet.persistent = false;
        if (state === 'warn' && o.resume) return notPaidView();
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

      /* Payment page closed with nothing paid: same as the website's "Payment cancelled" screen. */
      const notPaidView = () => {
        App.native.haptic('error');
        sheet.set(`<div class="res"><div class="res-ic err">${ui.icon('x')}</div><h3>Payment cancelled</h3>
          <p>Your payment wasn't completed, so your order hasn't been placed yet. If you already paid, please don't pay again. We will confirm it and deliver your bundle automatically.</p>${o.summary || ''}<p class="note" id="cn"></p></div>
          <div class="btn-col">${gwButtons()}<button class="btn btn-tonal tap" id="again">Check again</button><button class="btn btn-outline tap" id="done">Done</button></div>`);
        $('#done', sheet.el).addEventListener('click', () => sheet.close());
        $('#again', sheet.el).addEventListener('click', () => { done = false; sheet.persistent = true; closedAt = Date.now(); notPaid = 0; waitView('Checking your payment…'); wire(); loop(); });
        sheet.el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-resume]'); if (!b) return;
          ui.busy(b, true, 'Opening payment');
          let url;
          try { url = await o.resume(b.dataset.resume || null); } catch (x) { ui.busy(b, false); return ui.toast((x && x.message) || 'Could not restart the payment.', 'err'); }
          ui.busy(b, false);
          done = false; sheet.persistent = true; closedAt = null; notPaid = 0;
          if (!url) { waitView('Checking your payment…'); wire(); return check(); }   // it was already paid
          o.url = url; waitView('The secure payment page is open. Pay with Mobile Money or card, then you will come straight back here.'); wire();
          win = await App.native.openPayment(url, evt); loop();
        });
        if (!notified && o.onNotPaid) {
          notified = true;
          o.onNotPaid().then((r) => {
            if (!r) return;
            if (r.status && r.status !== 'pending_payment') { done = false; return check(); }   // it actually went through
            if (r.email) { const n = $('#cn', sheet.el); if (n) n.textContent = `We've emailed a link to ${r.email} so you can complete this payment later.`; }
          });
        }
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
      const evt = { onReturn: (u) => { try { o.onReturnUrl && o.onReturnUrl(u); } catch (_) {} closedAt = Date.now(); check(); }, onClose: () => { closedAt = Date.now(); check(); } };

      waitView(o.waitText || (o.url ? 'The secure payment page is open. Pay with Mobile Money or card, then you will come straight back here.' : 'Please wait…'));
      wire();
      const subs = [];
      if (P.App) P.App.addListener('appStateChange', (s) => { if (s.isActive) check(); }).then((x) => subs.push(x)).catch(() => {});
      const origDone = o.onDone; o.onDone = (st) => { if (st !== 'warn') subs.forEach((x) => { try { x.remove(); } catch (_) {} }); origDone && origDone(st); };
      (async () => { if (o.url) win = await App.native.openPayment(o.url, evt); loop(); })();
    },
  };
  /* Let the person choose a gateway when the admin has switched on more than one (as on the website).
     Resolves with a gateway key, null (none listed: the server decides), or undefined (cancelled). */
  App.pickGateway = (amount) => new Promise((resolve) => {
    const list = App.gatewaysFor(amount);
    if (list.length < 2) return resolve(list[0] ? list[0].key : null);
    const sh = ui.sheet({ onClose: () => resolve(undefined) });
    sh.set(`<h3 class="sheet-title">Choose payment method</h3><p class="sheet-sub">Pay with card or Mobile Money through:</p>
      <div class="btn-col">${list.map((g) => `<button class="btn btn-primary tap" data-gw="${esc(g.key)}">${esc(g.label)}</button>`).join('')}<button class="btn btn-outline tap" data-gw="">Cancel</button></div>`);
    sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-gw]'); if (!b) return; const k = b.dataset.gw; resolve(k || undefined); sh.close(); });
  });
  // order status -> tracker state
  App.pay.orderState = (status) => (status === 'delivered' ? 'ok' : status === 'failed' || status === 'refunded' ? 'err' : status === 'pending_payment' ? 'pending' : 'proc');
  // payment-confirm status -> tracker state
  App.pay.confirmState = (status) => (status === 'success' ? 'ok' : status === 'failed' ? 'err' : 'pending');
})();
