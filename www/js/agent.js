/* Become an agent, entirely inside the app: plans -> in-app payment -> storefront setup -> review. */
(() => {
  'use strict';
  const { $, $$, esc } = App;
  const ui = App.ui, fmt = App.fmt, S = App.state;
  const REGIONS = ['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern', 'Volta', 'Bono', 'Other'];
  const MOMO = ['MTN Mobile Money', 'AT Money', 'Telecel Cash'];
  const A = (App.agent = { REGIONS, MOMO });

  A.opts = (list, cur, ph) => (ph ? `<option value="">${esc(ph)}</option>` : '') + list.map((x) => `<option${x === cur ? ' selected' : ''}>${esc(x)}</option>`).join('');
  A.field = (id, label, inner, hint = '') => `<label class="field"><span>${esc(label)}</span>${inner}${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</label>`;
  A.input = (id, attrs = '', end = '') => `<div class="inp"><input id="${id}" ${attrs} />${end}</div>`;
  A.select = (id, list, cur, ph) => `<div class="inp sel"><select id="${id}">${A.opts(list, cur, ph)}</select>${ui.icon('chev-down', 'selic')}</div>`;

  /* Agents (and anyone buying as an agent) must set a transaction PIN once. */
  App.agentPin = () => new Promise((resolve) => {
    const s = ui.sheet({ onClose: (r) => resolve(!!r) });
    s.set(`<h3 class="sheet-title">Set your transaction PIN</h3><p class="sheet-sub">You need a 4-digit PIN before you can buy as an agent or request a withdrawal.</p>
      ${A.field('pn-pw', 'Account password', A.input('pn-pw', 'type="password" autocomplete="current-password"'))}
      ${A.field('pn-pin', '4-digit PIN', A.input('pn-pin', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off"'))}
      ${A.field('pn-pin2', 'Confirm PIN', A.input('pn-pin2', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off"'))}
      <div id="pn-msg"></div><div class="btn-col"><button class="btn btn-primary tap" id="pn-go">Save PIN</button></div>`);
    $('#pn-go', s.el).addEventListener('click', async () => {
      const b = $('#pn-go', s.el), pw = $('#pn-pw', s.el).value, pin = $('#pn-pin', s.el).value, pin2 = $('#pn-pin2', s.el).value, m = $('#pn-msg', s.el);
      const bad = (t) => { m.innerHTML = `<div class="err-msg">${esc(t)}</div>`; };
      if (!pw) return bad('Enter your account password.');
      if (!/^\d{4}$/.test(pin)) return bad('Your PIN must be exactly 4 digits.');
      if (pin !== pin2) return bad('The two PINs do not match.');
      ui.busy(b, true, 'Saving');
      const r = await App.api('/account/transaction-pin', { method: 'POST', body: { current_password: pw, pin, pin_confirmation: pin2 } });
      ui.busy(b, false);
      if (!r.ok) return bad(r.error);
      if (S.user) { S.user.has_transaction_pin = true; App.store.set('user', S.user); }
      ui.toast('Transaction PIN saved', 'ok'); s.close(true);
    });
  });

  /* ---------- entry point used by every "agent" button ---------- */
  A.open = () => {
    if (App.isAgent()) return A.dashboard();
    A.flow();
  };

  const BENEFITS = [
    ['package', 'No stock, ever', 'Data is delivered digitally. Nothing to buy, store or run out of.'],
    ['wallet', 'Fast MoMo payouts', 'Your commission lands straight in your Mobile Money account.'],
    ['briefcase', 'Your own brand', 'Customers see your name and logo. ASBData stays behind the scenes.'],
    ['refresh', 'Grow at your pace', 'Start small, then upgrade your plan as your customers grow.'],
  ];
  const STEPS = ['Choose a plan', 'Pay securely with Mobile Money or card', 'Set up your storefront', 'Get approved and start selling'];

  A.flow = async () => {
    const logged = App.session.loggedIn;
    const page = App.nav.push(`<button class="back tap" data-back aria-label="Back">${ui.icon('arrow-left')}</button><div class="page-body" id="afBody">${ui.skel(4)}</div>
      ${logged ? '' : `<div class="btn-col" style="margin-top:0"><button class="btn btn-primary tap" id="afLogin">Log in or sign up to get started</button></div>`}`);
    const body = $('#afBody', page);
    if (!logged) {
      App.afterLogin = () => A.open();
      $('#afLogin', page).addEventListener('click', () => App.actions.login());
      return render.marketing(body, null);
    }
    const reload = async () => {
      const r = await App.api('/agent/onboarding/status');
      if (!r.ok) { body.innerHTML = ui.empty('wifi-off', 'Could not load', r.error, '<button class="btn btn-tonal btn-sm tap" id="afRetry">Try again</button>'); const t = $('#afRetry', body); t && t.addEventListener('click', () => { body.innerHTML = ui.skel(4); reload(); }); return; }
      const st = r.data; A.status = st;
      if (st.stage === 'approved') { await App.refreshData(); App.nav.pop(); setTimeout(() => A.dashboard(), 350); return; }
      if (st.stage === 'awaiting_payment') return render.marketing(body, reload);
      if (st.stage === 'awaiting_business_profile' || st.stage === 'rejected') return render.profile(body, st, reload);
      return render.review(body);
    };
    reload();
  };

  const render = {
    async marketing(body, reload) {
      body.innerHTML = `
        <div class="agent-hero"><h1>Your own data business, live in days.</h1><p>Sell MTN, AirtelTigo and Telecel bundles under your own brand, with a website that is entirely yours. No shop, no stock, just a link you can share today.</p></div>
        <div class="list" style="margin-bottom:6px">${BENEFITS.map(([ic, t, d]) => `<div class="row"><span class="ci">${ui.icon(ic)}</span><span class="tx2"><b>${esc(t)}</b><small>${esc(d)}</small></span></div>`).join('')}</div>
        <div class="h-sec">How it works</div>
        <div class="steps">${STEPS.map((t, i) => `<div><i>${i + 1}</i><span>${esc(t)}</span></div>`).join('')}</div>
        <div class="h-sec">Choose your plan</div><div id="plans">${ui.skel(2)}</div>`;
      const r = await App.api('/agent-plans', { auth: false });
      const box = $('#plans', body);
      if (!r.ok) { box.innerHTML = `<div class="err-msg">${esc(r.error)}</div>`; return; }
      box.innerHTML = r.data.data.map((p) => `
        <div class="plan${p.key === 'website_app' ? ' pop' : ''}">${p.key === 'website_app' ? '<em>Most popular</em>' : ''}
          <div class="plan-top"><b>${esc(p.name)}</b><span>${fmt.money(p.price)}</span></div>
          <ul>${p.features.map((f) => `<li>${ui.icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
          ${reload ? `<button class="btn ${p.key === 'website_app' ? 'btn-primary' : 'btn-outline'} tap" data-plan="${esc(p.key)}">Choose ${esc(p.name)}</button>` : ''}
        </div>`).join('');
      if (!reload) return;
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-plan]'); if (!b) return;
        const plan = r.data.data.find((x) => x.key === b.dataset.plan);
        const gw = await App.pickGateway(plan.price);
        if (gw === undefined) return;                                   // cancelled
        ui.busy(b, true, 'Starting payment');
        const x = await App.api('/agent/plan', { method: 'POST', body: Object.assign({ plan: plan.key }, gw ? { gateway: gw } : {}) });
        ui.busy(b, false);
        if (!x.ok) return ui.toast(x.error, 'err');
        // The reference comes back from the server if it sends one, or from Payaza's URL, or from the page we return to.
        let ref = x.data.reference || null;
        if (!ref) { try { ref = new URL(x.data.authorization_url).searchParams.get('transaction_reference'); } catch (_) {} }
        const sheet = ui.sheet({ onClose: () => reload() });
        App.pay.track(sheet, {
          url: x.data.authorization_url, waitTitle: 'Pay for your plan',
          summary: `<div class="sum"><div><span>Plan</span><b>${esc(plan.name)}</b></div><div class="tot"><span>Amount</span><b>${fmt.money(plan.price)}</b></div></div>`,
          results: { ok: ['Plan activated', 'Payment received. Next, set up your storefront.'], err: ['Payment failed', 'Your plan was not paid for. You can try again anytime.'] },
          onReturnUrl(u) { const r = new URL(u).searchParams.get('reference'); if (r) ref = r; },
          async check() {
            if (ref) { const c = await App.api(`/payments/confirm/${encodeURIComponent(ref)}`); if (c.ok) { const st = App.pay.confirmState(c.data.status); if (st !== 'pending') return { state: st }; } }
            // No reference (e.g. Korapay): the plan flips to "paid" on the server, so watch your onboarding status instead.
            const s2 = await App.api('/agent/onboarding/status');
            return s2.ok ? { state: s2.data.stage !== 'awaiting_payment' ? 'ok' : 'pending' } : null;
          },
        });
      });
    },

    review(body) {
      body.innerHTML = `<div class="res" style="padding-top:40px"><div class="res-ic warn">${ui.icon('clock')}</div><h3>Under review</h3>
        <p>We are reviewing your storefront details. This usually takes less than 24 hours. We will email you as soon as you are approved.</p></div>
        <div class="btn-col"><button class="btn btn-tonal tap" id="rvRefresh">${ui.icon('refresh')}Check status</button><button class="btn btn-outline tap" data-back>Back to home</button></div>`;
      $('#rvRefresh', body).addEventListener('click', async (e) => {
        const b = e.currentTarget; ui.busy(b, true, 'Checking');
        const r = await App.api('/agent/onboarding/status'); ui.busy(b, false);
        if (r.ok && r.data.stage === 'approved') { await App.refreshData(); App.nav.closeAll(); setTimeout(() => A.dashboard(), 350); }
        else ui.toast(r.ok ? 'Still under review' : r.error, r.ok ? 'info' : 'err');
      });
    },

    profile(body, st, reload) {
      const plan = st.plan_details || {};
      let logoBlob = null;
      body.innerHTML = `<h1>Set up your storefront</h1><p class="lead">This is what your customers will see. You can change it later from your dashboard.</p>
        ${st.stage === 'rejected' ? `<div class="err-msg"><b>Changes needed</b><br>${esc(st.rejection_reason || 'Please review your details and resubmit.')}</div>` : ''}
        ${A.field('bp-name', 'Business name', A.input('bp-name', `maxlength="80" placeholder="e.g. Kofi Data Hub" value="${esc(st.business_name || '')}"`))}
        <div class="field"><span>Business logo</span><div class="upl"><img id="bp-prev" alt="" hidden /><div class="upl-ph" id="bp-ph">${ui.icon('plus')}</div>
          <button type="button" class="btn btn-tonal btn-sm tap" id="bp-pick">Choose logo</button><input id="bp-file" type="file" accept="image/*" hidden /></div><small class="hint">Square images work best.</small></div>
        ${A.field('bp-sub', 'Your website address', `<div class="inp sfx"><input id="bp-sub" maxlength="40" autocapitalize="none" autocomplete="off" placeholder="yourbrand" value="${esc(st.subdomain || '')}" /><span class="end suffix">.asbdataghana.com</span></div>`)}
        <div class="subrow"><span id="bp-subm" class="hint"></span><button type="button" class="link" id="bp-gen">Auto-generate for me</button></div>
        ${plan.includes_custom_domain ? A.field('bp-dom', 'Custom domain (optional)', A.input('bp-dom', `maxlength="120" autocapitalize="none" placeholder="yourbrand.com" value="${esc(st.custom_domain || '')}"`), 'Your plan includes a custom domain. Point its DNS to us once approved.') : ''}
        ${A.field('bp-reg', 'Region', A.select('bp-reg', REGIONS, '', 'Select region'))}
        ${A.field('bp-net', 'Mobile Money network', A.select('bp-net', MOMO, '', 'Select network'))}
        ${A.field('bp-num', 'Mobile Money number', A.input('bp-num', 'type="tel" inputmode="tel" maxlength="20" placeholder="024 000 0000"'), 'Your commission payouts are sent to this number.')}
        <div id="bp-err"></div>
        <div class="btn-col"><button class="btn btn-primary tap" id="bp-go">Submit for review</button></div>`;
      const sub = $('#bp-sub', body), m = $('#bp-subm', body), err = $('#bp-err', body);
      const clean = () => { sub.value = sub.value.toLowerCase().replace(/[^a-z0-9]/g, ''); };
      let t;
      const check = async () => {
        clean(); if (!sub.value) { m.textContent = ''; return; }
        const r = await App.api('/agent/onboarding/subdomain/check', { query: { value: sub.value } });
        if (!r.ok) { m.textContent = ''; return; }
        const mine = st.subdomain && st.subdomain === sub.value;
        m.textContent = r.data.available || mine ? '✓ Available' : '✗ Already taken'; m.style.color = r.data.available || mine ? 'var(--ok)' : 'var(--err)';
      };
      sub.addEventListener('input', () => { clean(); clearTimeout(t); t = setTimeout(check, 450); });
      $('#bp-gen', body).addEventListener('click', async () => {
        const r = await App.api('/agent/onboarding/subdomain/generate', { query: { business_name: $('#bp-name', body).value.trim() } });
        if (r.ok) { sub.value = r.data.value; check(); } else ui.toast(r.error, 'err');
      });
      $('#bp-pick', body).addEventListener('click', () => $('#bp-file', body).click());
      $('#bp-file', body).addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { logoBlob = await App.img.prepare(f, 800); } catch (x) { return ui.toast(x.message, 'err'); }
        const img = $('#bp-prev', body); img.src = URL.createObjectURL(logoBlob); img.hidden = false; $('#bp-ph', body).hidden = true;
      });
      $('#bp-go', body).addEventListener('click', async (e) => {
        const b = e.currentTarget, v = (id) => ($('#' + id, body) ? $('#' + id, body).value.trim() : '');
        const bad = (t) => { err.innerHTML = `<div class="err-msg">${esc(t)}</div>`; App.native.haptic('error'); };
        err.innerHTML = '';
        if (!v('bp-name')) return bad('Enter your business name.');
        if (!logoBlob) return bad('Please choose your business logo.');
        if (!/^[a-z0-9]{3,40}$/.test(v('bp-sub'))) return bad('Your website address must be 3 or more letters and numbers.');
        if (!v('bp-reg') || !v('bp-net')) return bad('Choose your region and Mobile Money network.');
        if (v('bp-num').replace(/\D/g, '').length < 9) return bad('Enter your Mobile Money number.');
        const f = new FormData();
        f.append('business_name', v('bp-name')); f.append('business_logo', logoBlob, 'logo.jpg'); f.append('subdomain', v('bp-sub'));
        f.append('region', v('bp-reg')); f.append('momo_network', v('bp-net')); f.append('momo_number', v('bp-num'));
        if (plan.includes_custom_domain && v('bp-dom')) f.append('custom_domain', v('bp-dom'));
        ui.busy(b, true, 'Submitting');
        const r = await App.api('/agent/onboarding/business-profile', { method: 'POST', form: f });
        ui.busy(b, false);
        if (!r.ok) return bad(r.error);
        ui.toast('Submitted for review', 'ok'); App.native.haptic('success');
        body.innerHTML = ui.skel(3); reload();
      });
    },
  };
})();
