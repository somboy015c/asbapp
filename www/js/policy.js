/* Privacy & Policy, shown inside the app. */
(() => {
  'use strict';
  const { esc } = App;
  const ui = App.ui;
  const SECTIONS = [
    ['Information we collect', ['Account details: name, email, phone number, and password (stored securely hashed. We never see it in plain text).', 'Order details: the recipient number and bundle you purchase, so we can deliver it and show your order history.', 'Agent business details: business name, logo, and Mobile Money payout information, if you register as an agent.', 'Payment information: handled entirely by our payment partners (Payaza and Korapay). We never receive or store your card number.']],
    ['How we use your information', ['To process and deliver your data bundle purchases.', 'To run your agent storefront and calculate commission, if you are an agent.', 'To contact you about your orders, account, or agent application.', 'To detect and prevent fraud or abuse of the platform.']],
    ['How we protect your information', 'Passwords are hashed, not stored in plain text. All traffic between your device and our servers is encrypted (HTTPS). Access to customer data within our team is limited to what is needed to support you.'],
    ['Sharing your information', 'We share order and payment details with our payment processors (Payaza and Korapay) and data delivery partners only as needed to complete your purchase. We do not sell your personal information to third parties.'],
    ['Refunds', 'Because data bundles are delivered instantly and cannot be recalled once sent, we are unable to reverse or refund an order delivered to the wrong number. If a bundle fails to deliver due to an error on our end, we will redeliver it or refund you in full.'],
    ['Your rights', 'You can request a copy of the personal data we hold about you, or ask us to delete your account, by contacting us from the Support tab.'],
    ['Changes to this policy', 'We may update this policy from time to time. Material changes will be posted here with an updated date.'],
  ];
  App.screens.policy = {
    open() {
      App.nav.push(`<button class="back tap" data-back aria-label="Back">${ui.icon('arrow-left')}</button>
        <div class="page-body"><h1>Privacy &amp; Policy</h1><p class="lead">Last updated: January 2026. This explains what information ASBData Ghana collects, how we use it, and your rights over it. By using our app, website, or storefronts, you agree to the terms described here.</p>
        ${SECTIONS.map(([h, b]) => `<div class="h-sec" style="text-transform:none;letter-spacing:0;font-size:16px;color:var(--ink);font-weight:700">${esc(h)}</div>` +
          (Array.isArray(b) ? `<ul class="plain">${b.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="para">${esc(b)}</p>`)).join('')}
        <p class="note" style="margin-top:22px">&copy; 2026 ASBData Ghana. All rights reserved.</p></div>`);
    },
  };
  App.actions.policy = () => App.screens.policy.open();
})();
