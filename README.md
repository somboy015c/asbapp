# ASBData Ghana: Mobile App (Capacitor)

The ASBData Ghana main website as a native-feeling Android app. Plain HTML/CSS/JavaScript in the `www` folder, wrapped with [Capacitor](https://capacitorjs.com).

**What's in it**
- Animated splash screen, then a 3-slide onboarding (first launch only)
- **No account needed to buy.** Guests pay with Mobile Money or card; accounts are optional (wallet + order history)
- Home, Buy Data, Orders, Support and Me tabs, light and dark mode, bottom sheets, ripples, haptics, spinners on every button action
- **Payaza and Korapay are both supported.** The app follows your admin Settings → Payment methods: one gateway switched on is used automatically, two lets the buyer choose, and a gateway is hidden for orders below its minimum amount (for example Korapay under GH₵10)
- **Payments happen inside the app.** The Payaza page opens in an in-app window; when payment finishes the app closes it, confirms the payment and shows the result
- **Become an agent, entirely in the app:** see the plans, pay for one, set up your storefront (logo, website address, payout details) and wait for approval
- **Agent dashboard, entirely in the app:** wallet and top-up, sales chart and commission stats, store settings (brand, logo and images, payout, contact and social), withdrawals, and your transaction PIN. Agents also see wholesale prices and can pay with their agent wallet, customer wallet or directly
- "Earn with ASBData" only shows to people who are not agents yet. Approved agents see an Agent Dashboard card instead
- The **only** page that leaves the app is **Visit my website** (your agent store), which opens in the phone's browser. Calling, WhatsApp and email naturally open the phone's own apps, and the update download opens the browser
- The app uses the same API as your website (`api.asbdataghana.com`), so prices, bundles and the guest-checkout switch in your admin panel apply instantly. No backend changes are needed

## Setup (once, all in the browser)

1. Create a new **public** GitHub repository and upload the *contents* of this folder (see "Don't see the Run workflow button?" below, the hidden `.github` folder matters).
2. **Settings → Actions → General → Workflow permissions →** choose **Read and write permissions**.

## Releasing (the button)

**Actions → Release Android app (APK) → Run workflow.** Pick patch / minor / major (or type an exact version) and optional notes. It builds and signs `ASBDataGhana.apk` and publishes it as the newest release (about 8 to 12 minutes). Nothing to run on your own computer.

Permanent download link for your website's Download App button:

```
https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.apk
```

Installed apps notice new releases by themselves (a banner on Home and **Me → About → Check for updates**) and send the person to the download.

**Installing:** open the link on an Android phone and allow "install from this source" when asked.

## Your images and details

- **Onboarding pictures:** replace `www/assets/onboarding/onboarding-1.png`, `-2.png`, `-3.png` (1080 × 1350 px works well). Keep the same file names, or change the names in `www/js/config.js`.
- **Phone, WhatsApp, email, website:** `www/js/config.js`.
- **App icon and splash screen:** replace the files in `assets/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`), then run the release button. They are turned into every Android size automatically.
- **Texts and colors:** `www/js/*.js` and `www/css/app.css`.

After uploading new files, press the release button to publish a new version.

## Don't see the Run workflow button?

GitHub only shows it when the file is exactly at `.github/workflows/android.yml` at the top level of the repo. Common causes: the `.github` folder wasn't uploaded (it starts with a dot, so drag-and-drop often skips it), or the folder itself was uploaded instead of its contents.

Fix: Add file → Create new file, type `.github/workflows/android.yml` as the name (typing the slashes creates the folders), paste in the contents of `workflow-copy/android.yml`, and commit. Then open the Actions tab.

## Good to know

- **Signing key:** the first release creates a signing key and saves it in `android-signing/` in your repo, so every later version can install over the old one. Because the repo is public, that key is public too. That is fine for downloading the APK from your own link. For Google Play, add your own key instead as repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`. The workflow uses them automatically when present.
- **Guest checkout** must be switched on in your admin panel (Settings). If it is off, the app asks people to log in before buying.
- **Payment flow:** after tapping Pay, the Payaza page opens inside the app. When the person comes back, the app checks the payment and shows the result. They can also tap "I have paid, check status". The in-app window uses the `@capgo/inappbrowser` plugin; if it can't load for any reason the app falls back to a browser tab instead of failing.
- **Cancelled or abandoned payments:** the app shows the same "Payment cancelled" screen as the website, emails the buyer the link to finish paying, and offers a button per gateway to pay again. Orders still waiting for payment also show "Complete payment" under Orders.
- **Photo uploads** (logo, store images) are shrunk on the phone before sending. They use the same API as your website's agent dashboard.
- **iPhone:** the same code runs on iOS, but building for iPhone needs a Mac and an Apple Developer account. It is not part of the button.
- **Local testing (optional):** install Node 22, JDK 21 and Android Studio, then `npm install`, `npx cap add android`, `npx capacitor-assets generate --android`, `npx cap sync android`, `npx cap open android`.
