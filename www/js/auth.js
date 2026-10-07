/* Optional account: login, 3-step register, forgot password. Nothing here is needed to buy data. */
(() => {
  'use strict';
  const { $, $$, esc } = App;
  const ui = App.ui, S = App.state;

  const field = (id, label, attrs = '', end = '') => `<label class="field"><span>${esc(label)}</span><div class="inp"><input id="${id}" ${attrs} />${end}</div></label>`;
  const eye = `<button type="button" class="end" data-eye aria-label="Show password">${ui.icon('eye')}</button>`;
  const bindEye = (root) => $$('[data-eye]', root).forEach((b) => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input'), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; b.innerHTML = ui.icon(show ? 'eye-off' : 'eye');
  }));

  async function afterAuth(token, user) {
    App.session.save(token, user);
    App.markStale('home', 'orders', 'me', 'shop');
    await App.refreshData();
    App.nav.closeAll();
    App.refresh('home', true);
    const cb = App.afterLogin; App.afterLogin = null;
    if (cb) setTimeout(cb, 380);
    ui.toast('Welcome' + (user && user.name ? ', ' + App.fmt.first(user.name) : ''), 'ok');
    App.native.haptic('success');
  }

  /* ---------- login ---------- */
  App.screens.login = {
    open() {
      const page = App.nav.push(`
        <button class="back tap" data-back aria-label="Back">${ui.icon('arrow-left')}</button>
        <div class="page-body">
          <h1>Welcome back</h1><p class="lead">Log in to see your wallet and keep your orders on every device. You can always buy without an account.</p>
          ${field('l-id', 'Email or phone', 'autocomplete="username" autocapitalize="none" placeholder="you@example.com"')}
          ${field('l-pw', 'Password', 'type="password" autocomplete="current-password" placeholder="Enter password"', eye)}
          <div id="l-err"></div>
          <p style="margin-top:14px;text-align:right"><button class="link" id="forgot">Forgot password?</button></p>
        </div>
        <div class="btn-col" style="margin-top:0"><button class="btn btn-primary tap" id="l-go">Log in</button>
        <button class="btn btn-outline tap" id="l-reg">Create an account</button></div>`);
      bindEye(page);
      const err = $('#l-err', page), go = $('#l-go', page);
      const submit = async () => {
        err.innerHTML = '';
        const login = $('#l-id', page).value.trim(), password = $('#l-pw', page).value;
        if (!login || !password) { err.innerHTML = '<div class="err-msg">Enter your email or phone and your password.</div>'; return; }
        ui.busy(go, true, 'Logging in');
        const r = await App.api('/auth/login', { method: 'POST', auth: false, body: { login, password } });
        ui.busy(go, false);
        if (!r.ok) {
          err.innerHTML = `<div class="err-msg">${esc(r.error)}</div>` + (r.code === 'unverified_email' ? '<button class="btn btn-tonal btn-sm tap" id="resend" style="margin-top:10px">Resend verification email</button>' : '');
          const rs = $('#resend', page);
          if (rs) rs.addEventListener('click', async () => { ui.busy(rs, true, 'Sending'); const x = await App.api('/auth/email/resend-public', { method: 'POST', auth: false, body: { login } }); ui.busy(rs, false); ui.toast(x.ok ? 'Verification email sent' : x.error, x.ok ? 'ok' : 'err'); });
          return;
        }
        afterAuth(r.data.token, r.data.user);
      };
      go.addEventListener('click', submit);
      $('#l-pw', page).addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      $('#l-reg', page).addEventListener('click', () => { App.nav.pop(); setTimeout(() => App.screens.register.open(), 300); });
      $('#forgot', page).addEventListener('click', () => App.screens.login.forgot($('#l-id', page).value));
    },
    forgot(prefill = '') {
      const s = ui.sheet({});
      s.set(`<h3 class="sheet-title">Reset password</h3><p class="sheet-sub">Enter your account email. We will send you a link to choose a new password.</p>
        ${field('f-email', 'Email', `type="email" autocomplete="email" value="${esc(String(prefill).includes('@') ? prefill : '')}" placeholder="you@example.com"`)}<div id="f-msg"></div>
        <div class="btn-col"><button class="btn btn-primary tap" id="f-go">Send reset link</button></div>`);
      $('#f-go', s.el).addEventListener('click', async () => {
        const b = $('#f-go', s.el), email = $('#f-email', s.el).value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#f-msg', s.el).innerHTML = '<div class="err-msg">Enter a valid email address.</div>'; return; }
        ui.busy(b, true, 'Sending');
        const r = await App.api('/auth/password/forgot', { method: 'POST', auth: false, body: { email } });
        ui.busy(b, false);
        $('#f-msg', s.el).innerHTML = r.ok ? `<p class="note" style="color:var(--ok)">${esc((r.data && r.data.message) || 'If that email has an account, a reset link is on its way.')}</p>` : `<div class="err-msg">${esc(r.error)}</div>`;
      });
    },
  };

  /* ---------- register: 3 steps ---------- */
  App.screens.register = {
    open() {
      const d = { name: '', email: '', phone: '', password: '' };
      let step = 1;
      const page = App.nav.push(`<button class="back tap" data-back aria-label="Back">${ui.icon('arrow-left')}</button>
        <div class="stepno" id="stepno">STEP 1 OF 3</div><div class="stepbar" id="stepbar"><i class="on"></i><i></i><i></i></div>
        <div class="page-body" id="stepBody"></div>
        <div class="btn-col" style="margin-top:0"><button class="btn btn-primary tap" id="r-next">Continue</button></div>`);
      const body = $('#stepBody', page), next = $('#r-next', page);
      const views = {
        1: () => `<div class="step"><h1>What's your name?</h1><p class="lead">Use the name you want on your account.</p>${field('r-name', 'Full name', `autocomplete="name" placeholder="Kofi Mensah" value="${esc(d.name)}"`)}<div id="r-err"></div></div>`,
        2: () => `<div class="step"><h1>How can we reach you?</h1><p class="lead">We send receipts and order updates here.</p>${field('r-email', 'Email', `type="email" autocomplete="email" placeholder="you@example.com" value="${esc(d.email)}"`)}${field('r-phone', 'Phone number', `type="tel" inputmode="tel" autocomplete="tel" placeholder="024 123 4567" value="${esc(d.phone)}"`)}<div id="r-err"></div></div>`,
        3: () => `<div class="step"><h1>Set a password</h1><p class="lead">At least 8 characters. Mix letters, numbers and symbols for a stronger one.</p>${field('r-pw', 'Password', 'type="password" autocomplete="new-password" placeholder="Enter password"', eye)}
          <div class="strength" id="str"><i></i><i></i><i></i><i></i></div><div class="strength-l" id="strl"></div>${field('r-pw2', 'Confirm password', 'type="password" autocomplete="new-password" placeholder="Repeat password"')}<div id="r-err"></div></div>`,
      };
      const render = () => {
        body.innerHTML = views[step]();
        $('#stepno', page).textContent = `STEP ${step} OF 3`;
        $$('#stepbar i', page).forEach((i, n) => i.classList.toggle('on', n < step));
        next.textContent = step === 3 ? 'Create account' : 'Continue';
        bindEye(body);
        const pw = $('#r-pw', body);
        if (pw) pw.addEventListener('input', () => {
          const s = ui.strength(pw.value), cols = ['#D1344A', '#E08A1E', '#C9B20A', '#17935A'];
          $$('#str i', body).forEach((i, n) => { i.style.background = n < s ? cols[Math.max(0, s - 1)] : ''; });
          $('#strl', body).textContent = pw.value ? ['Very weak', 'Weak', 'Okay', 'Good', 'Strong'][s] : '';
        });
        const f = body.querySelector('input'); setTimeout(() => f && f.focus(), 350);
      };
      const err = (t) => { $('#r-err', body).innerHTML = `<div class="err-msg">${esc(t)}</div>`; App.native.haptic('error'); };
      next.addEventListener('click', async () => {
        if (step === 1) { d.name = $('#r-name', body).value.trim(); if (d.name.length < 2) return err('Please enter your name.'); step = 2; return render(); }
        if (step === 2) {
          d.email = $('#r-email', body).value.trim(); d.phone = $('#r-phone', body).value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return err('Enter a valid email address.');
          if (d.phone.replace(/\D/g, '').length < 9) return err('Enter a valid phone number.');
          step = 3; return render();
        }
        d.password = $('#r-pw', body).value;
        if (d.password.length < 8) return err('Your password must be at least 8 characters.');
        if (d.password !== $('#r-pw2', body).value) return err('The two passwords do not match.');
        ui.busy(next, true, 'Creating account');
        const r = await App.api('/auth/register', { method: 'POST', auth: false, body: { name: d.name, email: d.email, phone: d.phone, password: d.password, password_confirmation: d.password } });
        ui.busy(next, false);
        if (!r.ok) {
          if (/email/i.test(r.error)) { step = 2; render(); } else if (/phone/i.test(r.error)) { step = 2; render(); }
          return err(r.error);
        }
        await afterAuth(r.data.token, r.data.user);
        ui.toast('Account created. Check your email to verify it.', 'ok');
      });
      page._stepBack = () => { if (step > 1) { step--; render(); return true; } return false; };
      render();
    },
  };

  Object.assign(App.actions, {
    login: () => App.screens.login.open(),
    register: () => App.screens.register.open(),
    'resend-verify': async (el) => { ui.busy(el, true); const r = await App.api('/auth/email/resend', { method: 'POST' }); ui.busy(el, false); ui.toast(r.ok ? 'Verification email sent' : r.error, r.ok ? 'ok' : 'err'); },
  });
})();
