/* Three-slide onboarding with swipe, animated dots and parallax-in text. */
(() => {
  'use strict';
  const { $, $$, esc } = App;

  const SLIDES = [
    { title: 'Cheap data, delivered in minutes', text: 'Affordable, fast and reliable. Buy MTN, Telecel and AirtelTigo bundles in a few taps.' },
    { title: 'No account needed. Pay with Mobile Money on the go', text: 'Buy as a guest and pay with Mobile Money or card. Seamless, fast, instant top-up.' },
    { title: 'Become an agent and run your storefront', text: 'Start your own data business with your own store, set up and managed right here in the app.' },
  ];

  App.onboarding = {
    run() {
      return new Promise((resolve) => {
        const root = $('#onboard');
        root.hidden = false;
        root.innerHTML = `
          <button class="ob-skip tap" id="obSkip">Skip</button>
          <div class="ob-track" id="obTrack">${SLIDES.map((s, i) => `
            <div class="ob-slide${i ? '' : ' on'}">
              <div class="ob-img"><img src="${esc(App.cfg.ONBOARDING[i])}" alt="" /></div>
              <div class="ob-copy">
                <div class="ob-brand"><i><img src="assets/mark.png" alt="" /></i><span><b>ASB</b>Data</span></div>
                <h1>${esc(s.title)}</h1><p>${esc(s.text)}</p>
              </div>
            </div>`).join('')}</div>
          <div class="ob-foot">
            <div class="dots">${SLIDES.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
            <button class="btn btn-primary tap" id="obNext">Next</button>
            <button class="btn btn-outline tap" id="obLogin" style="visibility:hidden">Log in</button>
          </div>`;

        const track = $('#obTrack', root), slides = $$('.ob-slide', root), dots = $$('.dots i', root);
        const next = $('#obNext', root), login = $('#obLogin', root);
        let idx = 0;
        const go = (i) => {
          idx = Math.max(0, Math.min(SLIDES.length - 1, i));
          track.style.transform = `translateX(${-idx * (100 / SLIDES.length)}%)`;
          slides.forEach((s, n) => s.classList.toggle('on', n === idx));
          dots.forEach((d, n) => d.classList.toggle('on', n === idx));
          const last = idx === SLIDES.length - 1;
          next.textContent = last ? 'Get started' : 'Next';
          login.style.visibility = last ? 'visible' : 'hidden';
          $('#obSkip', root).style.display = last ? 'none' : '';
        };
        const finish = (to) => {
          App.store.set('onboarded', true);
          root.style.transition = 'opacity .4s, transform .5s';
          root.style.opacity = '0'; root.style.transform = 'scale(1.03)';
          setTimeout(() => { root.hidden = true; resolve(to); }, 420);
        };
        next.addEventListener('click', () => (idx < SLIDES.length - 1 ? go(idx + 1) : finish('home')));
        login.addEventListener('click', () => finish('login'));
        $('#obSkip', root).addEventListener('click', () => finish('home'));

        // swipe
        let x0 = null, y0 = 0;
        track.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
        track.addEventListener('touchend', (e) => {
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { App.native.haptic('light'); go(idx + (dx < 0 ? 1 : -1)); }
          x0 = null;
        });
        App.onboarding.back = () => { if (idx > 0) { go(idx - 1); return true; } return false; };
        go(0);
      });
    },
  };
})();
