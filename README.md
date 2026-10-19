# ASBData Ghana: Mobile App (Android + iPhone)

One codebase for the ASBData Ghana app on **Android and iPhone**, built with [Capacitor](https://capacitorjs.com). Plain HTML/CSS/JavaScript lives in the `www` folder.

**To publish it, follow `STORE-GUIDE.md`** (Google Play and App Store, step by step). Ready-to-paste store text is in `STORE-LISTING.md`.

## What the app does
- Animated splash, 3-slide onboarding (your photos in `www/assets/onboarding`), light mode by default
- **No account needed to buy.** Guests pay with Mobile Money or card; an account is optional (wallet, order history)
- Follows your admin Settings → Payment methods: Payaza and Korapay, a buyer's choice when both are on, minimum amounts, cancelled-payment emails and "pay again"
- **Payment happens inside the app** in a secure in-app payment screen, then the app confirms and shows the result
- Signing up asks the person to verify their email, and the app signs them in automatically once they have
- **Become an agent and run the agent dashboard, entirely in the app:** plans, storefront setup, overview, orders (received and your own), sales and chart, transactions, store settings, plan upgrades, withdrawals, transaction PIN
- Phone and Mobile Money numbers follow your 10-digit rules
- **Delete Account** inside the app (needed by both stores)
- The only link that leaves the app is **Visit my website** (your agent's store). Calling, WhatsApp and email open the phone's own apps

## Setup (once, in the browser)
1. Create a new **public** GitHub repository and upload the *contents* of this folder (the hidden `.github` folder matters, see below).
2. **Settings → Actions → General → Workflow permissions → Read and write permissions.**

## The two buttons
- **Actions → Release Android (Play Store AAB + APK) → Run workflow.** Builds a signed `ASBDataGhana.aab` (upload to Google Play) and `ASBDataGhana.apk` (direct download), raises the version and publishes both as the newest release.
- **Actions → Release iPhone app (App Store / TestFlight) → Run workflow.** Builds the iPhone app on a Mac in the cloud and uploads it to App Store Connect. It needs your Apple credentials as 7 secrets (STORE-GUIDE.md, Part C).

Direct-download link: `https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.apk`

## Things you can change
- `www/js/config.js`: API address, contact details, onboarding image paths, update behaviour, store links
- `www/assets/onboarding/`: the three onboarding photos (4:5 portrait, about 880 × 1100)
- `assets/`: app icon and splash screen sources (turned into every size automatically)
- `www/js/*.js` and `www/css/app.css`: screens, texts and colors

After changing files, run the buttons again to publish a new version.

## Don't see the Run workflow button?
GitHub only shows it when the files are exactly at `.github/workflows/android.yml` and `.github/workflows/ios.yml` at the top level of the repo. Common causes: the `.github` folder was not uploaded (it starts with a dot, so drag-and-drop often skips it), or the folder itself was uploaded instead of its contents. Fix: Add file → Create new file, type `.github/workflows/android.yml` as the name, paste the contents of `workflow-copy/android.yml`, commit, and repeat for `ios.yml`.

## Good to know
- **Signing keys:** with no secrets the Android workflow creates a key and saves it in your public repo. That is fine for testing and direct downloads. For Google Play use your own private key (STORE-GUIDE.md, B1 and B2).
- **Guest checkout** must be switched on in your admin panel. If it is off the app asks people to log in first.
- **Backend change for the stores:** deploy `backend-account-deletion` so Delete Account works. `backend-optional-reference` from earlier is no longer needed (your server now returns payment references itself).
- **Local testing (optional):** Node 22, JDK 21 and Android Studio (or Xcode on a Mac): `npm install`, `npx cap add android`, `npx capacitor-assets generate --android`, `npx cap sync android`, `npx cap open android`.
