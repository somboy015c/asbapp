/* Support tab: contact tiles, FAQs and policy. */
(() => {
  'use strict';
  const { esc } = App;
  const ui = App.ui, cfg = App.cfg;
  const FAQ = [
    ["My data hasn't arrived yet. What do I do?", "Delivery normally takes a few minutes after payment. If it has been longer than an hour, open Orders to see the status, then message us on WhatsApp with the order reference."],
    ["I entered the wrong recipient number", "Once a bundle is delivered it can't be reversed or refunded, so please double-check the number first. If it hasn't been delivered yet, contact us right away and we will try to stop it."],
    ["What payment methods do you accept?", "Mobile Money (MTN, AT, Telecel) and major debit or credit cards, processed securely through Payaza. We never see or store your card details."],
    ["Do I need an account to buy?", "No. You can buy as a guest. An account gives you a wallet for refunds and keeps your order history on every device."],
    ["How do I become an agent?", "Tap Agents on the Home tab (or Earn with ASBData). Pick a plan, pay in the app, set up your storefront and we review it within 24 hours."],
  ];
  const tile = (icon, title, sub, attr) => `<button class="row tap" ${attr}><span class="ci">${ui.icon(icon)}</span><span class="tx2"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="chev">${ui.icon('chev-right')}</span></button>`;

  App.screens.support = {
    render() {
      return `<div class="stag"><h1 class="page-title">Support</h1><p class="page-sub">We are here to help, every day.</p>
        <div class="list">
          ${tile('phone', 'Call', cfg.PHONE, `data-act="call"`)}
          ${tile('whatsapp', 'WhatsApp', 'Chat with our team', `data-url="https://wa.me/${cfg.WHATSAPP}"`)}
          ${tile('mail', 'Email us', cfg.EMAIL, `data-act="email"`)}
        </div>
        <div class="h-sec">Frequently asked</div>
        ${FAQ.map(([q, a]) => `<div class="faq"><button class="tap" data-faq data-quiet="1"><span>${esc(q)}</span>${ui.icon('chev-down')}</button><div class="a">${esc(a)}</div></div>`).join('')}
        <div class="list" style="margin-top:6px">${tile('file', 'Privacy & Policy', 'Read how we handle your data', `data-act="policy"`)}</div>
      </div>`;
    },
    mount(root) {
      root.addEventListener('click', (e) => {
        const f = e.target.closest('[data-faq]'); if (f) f.parentElement.classList.toggle('open');
      });
    },
  };
  Object.assign(App.actions, {
    call: () => App.native.link(`tel:${cfg.PHONE}`),
    email: () => App.native.link(`mailto:${cfg.EMAIL}`),
  });
})();
