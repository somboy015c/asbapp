/* Me tab: profile, preferences, security, about, log out. */
(() => {
  'use strict';
  const { $, esc } = App;
  const ui = App.ui, fmt = App.fmt, S = App.state;
  const row = (icon, title, sub, attr, cls = '') => `<button class="row tap ${cls}" ${attr}><span class="ci">${ui.icon(icon)}</span><span class="tx2"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="chev">${ui.icon('chev-right')}</span></button>`;

  App.screens.me = {
    render() {
      const logged = App.session.loggedIn, u = S.user || {};
      const head = logged
        ? `<div class="prof"><div class="av">${esc(fmt.initials(u.name))}</div><div><b>${esc(u.name || 'Account')}</b><small>${esc(u.email || u.phone || '')}</small></div></div>`
        : `<div class="prof"><div class="av">${ui.icon('user')}</div><div><b>Guest</b><small>Buying without an account</small></div></div>
           <div class="btn-col" style="margin:0 0 14px"><button class="btn btn-primary tap" data-act="login">Log in</button><button class="btn btn-outline tap" data-act="register">Create an account</button></div>`;
      return `<div class="stag"><h1 class="page-title">Settings</h1><div style="height:8px"></div>${head}
        ${App.isAgent()
          ? `<div class="banner">${ui.icon('briefcase')}<div><b>Agent Dashboard</b>Your store, wallet and withdrawals.</div><button class="tap" data-act="agent">Open</button></div>`
          : `<div class="banner">${ui.icon('briefcase')}<div><b>Earn with ASBData</b>${logged && u.agent_status === 'rejected' ? 'Update your agent application.' : 'Become an agent and get your own store.'}</div><button class="tap" data-act="agent">${logged && u.agent_status === 'rejected' ? 'Update' : 'Open'}</button></div>`}
        <div class="list">
          ${logged ? row('user', 'Profile Details', 'See your account details.', 'data-act="profile"') : ''}
          ${row('sliders', 'Preference', 'Dark mode and feedback.', 'data-act="prefs"')}
          ${logged ? row('lock', 'Security', 'Change your password.', 'data-act="security"') : ''}
          ${row('help', 'Get Help', 'Reach out for support anytime.', 'data-tab="support"')}
          ${row('file', 'Privacy & Policy', 'How we handle your data.', 'data-act="policy"')}
          ${row('info', 'About', 'Version and updates.', 'data-act="about"')}
          ${logged ? row('logout', 'Log Out', 'Sign out of this device.', 'data-act="logout"', 'danger') : ''}
        </div></div>`;
    },
  };

  const sw = (id, on) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} /><span></span></label>`;

  Object.assign(App.actions, {
    profile() {
      const u = S.user || {}, s = ui.sheet({});
      s.set(`<h3 class="sheet-title">Profile details</h3><div style="margin-top:8px">
        <div class="kv"><span>Name</span><b>${esc(u.name || '-')}</b></div><div class="kv"><span>Email</span><b>${esc(u.email || '-')}</b></div>
        <div class="kv"><span>Phone</span><b>${esc(u.phone || '-')}</b></div><div class="kv"><span>Email status</span><b>${u.email_verified ? 'Verified' : 'Not verified'}</b></div></div>`);
    },
    prefs() {
      const s = ui.sheet({}), dark = document.documentElement.dataset.theme === 'dark';
      s.set(`<h3 class="sheet-title">Preference</h3><div style="margin-top:6px">
        <div class="setrow"><div><b>Dark mode</b><small>Easier on the eyes at night</small></div>${sw('p-dark', dark)}</div>
        <div class="setrow"><div><b>Haptic feedback</b><small>Gentle vibration on taps</small></div>${sw('p-hap', App.store.get('haptics', false) === true)}</div></div>`);
      $('#p-dark', s.el).addEventListener('change', (e) => App.setTheme(e.target.checked ? 'dark' : 'light'));
      $('#p-hap', s.el).addEventListener('change', (e) => App.store.set('haptics', e.target.checked));
    },
    security() {
      const s = ui.sheet({});
      const f = (id, l, ac) => `<label class="field"><span>${l}</span><div class="inp"><input id="${id}" type="password" autocomplete="${ac}" /></div></label>`;
      s.set(`<h3 class="sheet-title">Change password</h3>${f('s-cur', 'Current password', 'current-password')}${f('s-new', 'New password', 'new-password')}${f('s-new2', 'Confirm new password', 'new-password')}<div id="s-msg"></div>
        <div class="btn-col"><button class="btn btn-primary tap" id="s-go">Update password</button></div>`);
      $('#s-go', s.el).addEventListener('click', async () => {
        const b = $('#s-go', s.el), cur = $('#s-cur', s.el).value, pw = $('#s-new', s.el).value, pw2 = $('#s-new2', s.el).value, m = $('#s-msg', s.el);
        if (!cur || pw.length < 8) { m.innerHTML = '<div class="err-msg">Enter your current password and a new one of at least 8 characters.</div>'; return; }
        if (pw !== pw2) { m.innerHTML = '<div class="err-msg">The new passwords do not match.</div>'; return; }
        ui.busy(b, true, 'Updating');
        const r = await App.api('/account/change-password', { method: 'POST', body: { current_password: cur, password: pw, password_confirmation: pw2 } });
        ui.busy(b, false);
        if (!r.ok) { m.innerHTML = `<div class="err-msg">${esc(r.error)}</div>`; return; }
        s.close(); ui.toast('Password updated', 'ok'); App.native.haptic('success');
      });
    },
    about() {
      const s = ui.sheet({});
      s.set(`<h3 class="sheet-title">About</h3><div style="margin-top:8px">
        <div class="kv"><span>App version</span><b>${esc(S.version)}</b></div><div class="kv"><span>Website</span><b>${esc(App.cfg.SITE.replace('https://', ''))}</b></div><div class="kv"><span>Support</span><b>${esc(App.cfg.EMAIL)}</b></div></div>
        <div class="btn-col"><button class="btn btn-tonal tap" id="a-up">${ui.icon('refresh')}Check for updates</button></div><div id="a-msg"></div>`);
      $('#a-up', s.el).addEventListener('click', async () => {
        const b = $('#a-up', s.el); ui.busy(b, true, 'Checking');
        const u = await App.checkUpdate();
        ui.busy(b, false);
        $('#a-msg', s.el).innerHTML = u
          ? `<p class="note">Version ${esc(u.version)} is available.</p><div class="btn-col" style="margin-top:8px"><button class="btn btn-primary tap" data-url="${esc(u.url)}">Download update</button></div>`
          : '<p class="note" style="color:var(--ok)">You are on the latest version.</p>';
      });
    },
    async logout() {
      if (!(await ui.confirm({ title: 'Log out?', message: 'You can still buy data as a guest after logging out.', ok: 'Log out', danger: true }))) return;
      try { await Promise.race([App.api('/auth/logout', { method: 'POST' }), App.sleep(2500)]); } catch (_) {}
      App.session.clear(); S.agentWallet = null;
      App.markStale('home', 'orders', 'me');
      App.refresh('me', true); App.refresh('home', true);
      ui.toast('Logged out', 'ok');
    },
  });
})();
