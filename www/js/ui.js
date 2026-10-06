/* UI kit: icons, toast, bottom sheets, dialogs, busy buttons, ripple. */
(() => {
  'use strict';
  const { $, esc } = App;
  const ui = App.ui;

  ui.icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  ui.pill = (text, tone) => `<span class="pill pill-${tone}">${esc(text)}</span>`;
  const TONES = { delivered: 'ok', paid: 'ok', processing: 'warn', pending_payment: 'warn', failed: 'err', refunded: 'gray' };
  ui.status = (s) => ui.pill(s === 'pending_payment' ? 'Awaiting payment' : App.fmt.label(s), TONES[s] || 'gray');

  /* ---------- busy buttons: spinner + disabled, width kept ---------- */
  ui.busy = (btn, on, text) => {
    if (!btn) return;
    if (on) {
      btn.dataset.html = btn.dataset.html || btn.innerHTML;
      btn.style.minWidth = btn.offsetWidth + 'px';
      btn.disabled = true; btn.classList.add('is-busy');
      btn.innerHTML = `<span class="spin"></span>${text ? `<span>${esc(text)}</span>` : ''}`;
    } else {
      btn.disabled = false; btn.classList.remove('is-busy'); btn.style.minWidth = '';
      if (btn.dataset.html) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
    }
  };

  /* ---------- toast ---------- */
  ui.toast = (msg, kind = 'info') => {
    const root = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.textContent = msg;
    root.replaceChildren(el);
    requestAnimationFrame(() => el.classList.add('in'));
    clearTimeout(ui._tt);
    ui._tt = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, kind === 'err' ? 4200 : 2600);
    if (kind === 'err') App.native.haptic('error');
  };

  /* ---------- bottom sheets ---------- */
  ui.sheets = [];
  ui.sheet = ({ html, persistent = false, onClose } = {}) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-back"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"><i></i></div><div class="sheet-body"></div></div>`;
    $('#sheetRoot').appendChild(wrap);
    const sheet = wrap.querySelector('.sheet'), body = wrap.querySelector('.sheet-body');
    body.innerHTML = html || '';
    requestAnimationFrame(() => wrap.classList.add('in'));
    const ctl = {
      el: body, persistent,
      set(h) { body.innerHTML = h; body.scrollTop = 0; },
      close(result) {
        if (ctl.closed) return; ctl.closed = true;
        ui.sheets = ui.sheets.filter((s) => s !== ctl);
        sheet.style.transform = ''; wrap.classList.remove('in');
        setTimeout(() => wrap.remove(), 320);
        onClose && onClose(result);
      },
    };
    wrap.querySelector('.sheet-back').addEventListener('click', () => { if (!persistent) ctl.close(); });
    // drag the handle down to dismiss
    const grab = wrap.querySelector('.grab'); let y0 = null, dy = 0;
    grab.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
    grab.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    grab.addEventListener('touchend', () => {
      sheet.style.transition = '';
      if (dy > 110 && !persistent) ctl.close(); else sheet.style.transform = '';
      y0 = null; dy = 0;
    });
    ui.sheets.push(ctl);
    return ctl;
  };

  /* ---------- dialogs ---------- */
  ui.confirm = ({ title, message, ok = 'Confirm', danger = false }) => new Promise((resolve) => {
    const s = ui.sheet({ onClose: (r) => resolve(!!r) });
    s.set(`<h3 class="sheet-title">${esc(title)}</h3><p class="sheet-sub">${esc(message || '')}</p>
      <div class="btn-col"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button>
      <button class="btn btn-outline" data-r="0">Cancel</button></div>`);
    s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) s.close(b.dataset.r === '1'); });
  });

  /* ---------- ripple + press feedback on anything .tap ---------- */
  document.addEventListener('pointerdown', (e) => {
    const host = e.target.closest && e.target.closest('.tap');
    if (!host || host.disabled) return;
    const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
    if (!host.dataset.quiet) App.native.haptic('light');
  });

  /* ---------- small shared pieces ---------- */
  ui.empty = (icon, title, text, action = '') => `
    <div class="empty"><div class="empty-ic">${ui.icon(icon)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p>${action}</div>`;
  ui.skel = (n = 3) => Array.from({ length: n }, () => '<div class="skel-row"><i class="sk-av"></i><div><i></i><i></i></div></div>').join('');
  ui.orderRow = (o, i = 0) => {
    const m = App.netMeta(o.network);
    return `<button class="tx tap" data-order="${esc(o.ref || o.id)}" style="--i:${i}">
      <span class="net" style="background:${m.bg};color:${m.fg}">${esc(m.tag)}</span>
      <span class="tx-main"><b>${esc(o.size || o.bundle_size)} · ${esc(o.network)}</b><small>${esc(o.number || o.recipient_number)} · ${esc(App.fmt.date(o.at || o.created_at))}</small></span>
      <span class="tx-end"><b>${App.fmt.money(o.amount)}</b>${ui.status(o.status)}</span></button>`;
  };
  ui.strength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (pw.length && pw.length < 8) s = Math.min(s, 1);
    return s; // 0..4
  };
})();
