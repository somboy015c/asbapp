# Publishing to Google Play and the App Store

This guide takes you from this project to live listings. Do Part A first, then Part B (Android), Part C (iPhone), and finish with Part D.

Store rules change from time to time. Where I mention a rule, double-check it on the store's own page when you reach that step.

**Your app details (used throughout)**
- App name: **ASBData Ghana**
- App ID / bundle ID: **com.asbdataghana.app** (you cannot change this after your first upload)
- Privacy policy: https://asbdataghana.com/policy
- Account deletion page: https://asbdataghana.com/delete-account
- Support: hello@asbdataghana.com

---

## Part A: Before you start (both stores)

**A1. Deploy the account-deletion change to your server.** Both stores reject apps that let people sign up but not delete their account. Copy the files from the `backend-account-deletion` folder into your Laravel project, run `php artisan route:clear`, and test **Me → Delete Account** once with a throwaway account. Also check that https://asbdataghana.com/delete-account opens.

**A2. Create a reviewer account.** Reviewers can't create their own account and can't pay with real money, so prepare:
1. A normal customer account with a **verified email** (for example `reviewer@asbdataghana.com`) and a password you will give to the stores.
2. In your admin panel, credit that account's wallet with about GH₵20. The reviewer can then complete a purchase by choosing **Wallet** at checkout, without any real payment.

**A3. Get real screenshots.** Install the app on your own phone and take screenshots of: Home, Buy Data (bundle list), the buy screen, Orders, Support, and the agent dashboard. Use real screens, not mock-ups. Details on sizes are in each part below.

**A4. Have these ready:** the privacy policy URL, the deletion URL, a support email, and a 512×512 icon. The icon and a Play feature graphic are already in the `store-assets` folder.

**A5. Check the settings in `www/js/config.js`:**
- `UPDATE_CHECK` stays `'off'` for store builds. Stores deliver updates themselves, and Google Play does not allow an app to point people to a downloaded APK for updates. (The workflow turns it on only inside the direct-download APK.)
- `HIDE_AGENT_PURCHASE_ON_IOS` stays `false` for now. See C9.

---

## Part B: Android and Google Play

**Cost:** one-time US$25 for a Google Play Console account.

### B1. Create a private signing key (do this once, recommended)

Google Play needs every upload signed with the same key forever. The workflow will create a key by itself if you add nothing, but that key is saved in your **public** repo. For Play, use your own private key instead.

Easiest, no commands: install Android Studio, choose **Build → Generate Signed App Bundle / APK → Android App Bundle → Create new…**, fill in the form, and save the `.jks` file somewhere safe. Write down the store password, key alias and key password. If you lose this file you cannot update your app normally, so back it up in two places.

(If you prefer a command: `keytool -genkeypair -v -keystore asbdata-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`.)

### B2. Add the key to GitHub as secrets

Convert the key file to text:
- **Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("asbdata-upload.jks")) | Set-Clipboard`
- **Mac/Linux:** `base64 -i asbdata-upload.jks | pbcopy` (Linux: `base64 -w0 asbdata-upload.jks`)

In your repo go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the text you just copied |
| `ANDROID_KEYSTORE_PASSWORD` | your store password |
| `ANDROID_KEY_ALIAS` | your key alias (for example `upload`) |
| `ANDROID_KEY_PASSWORD` | your key password (leave out if it is the same as the store password) |

### B3. Build the app bundle

**Actions → Release Android (Play Store AAB + APK) → Run workflow.** After about 10 minutes the new release has two files:
- `ASBDataGhana.aab` is the file you upload to Google Play.
- `ASBDataGhana.apk` is for direct download from your website or WhatsApp.

Download the `.aab` from the release page.

### B4. Create the app in Play Console

1. Go to https://play.google.com/console and create your developer account (identity verification can take a few days).
2. **Create app**: name *ASBData Ghana*, default language English (United Kingdom or Ghana if offered), type **App**, **Free**. Accept the declarations.
3. Open **Dashboard** and complete every task it lists. Typical answers:

| Task | What to enter |
|---|---|
| Privacy policy | https://asbdataghana.com/policy |
| App access | "All or some functionality is restricted". Add the reviewer login from A2 and say: "No login is needed to browse and buy as a guest. The test account shows the wallet, orders and agent features." |
| Ads | No, the app does not contain ads |
| Content rating | Fill the questionnaire honestly. For this app: no violence, no user-generated public content, no gambling. Category: Utility/Productivity. |
| Target audience | 18 and over (the app handles payments) |
| Data safety | See the table below |
| Financial features | Read the form carefully. The app holds a wallet balance for refunds and agent payouts. Answer according to what the form asks about stored value. |
| Government apps / health / news | Not applicable |

**Data safety answers** (adjust if your backend collects more):

| Data | Collected | Shared | Why |
|---|---|---|---|
| Name | Yes | No | Account, order receipts |
| Email address | Yes | No | Account, receipts, verification |
| Phone number | Yes | No | Account, order contact |
| Purchase history | Yes | No | Orders and support |
| Photos | Yes (optional, agents only) | No | Store logo and images |
| Payment info (card / Mobile Money) | **No.** Payment happens on our payment partners' pages (Payaza, Korapay). | | |
| Location, contacts, device IDs, advertising data | No | | |

Also say: data is encrypted in transit (yes), people can ask for data to be deleted (yes), with the in-app path (*Me → Delete Account*) and the web link https://asbdataghana.com/delete-account.

### B5. Store listing

Under **Grow → Store presence → Main store listing**, use the texts in `STORE-LISTING.md` and upload:
- **App icon:** `store-assets/play-icon-512.png`
- **Feature graphic:** `store-assets/play-feature-graphic-1024x500.png`
- **Phone screenshots:** at least 2 (PNG or JPEG, portrait, shortest side at least 320 px, longest side no more than 2× the shortest). Your real phone screenshots are fine.

### B6. Upload your first release

1. **Testing → Internal testing → Create new release**. Accept **Play App Signing** when asked. Upload `ASBDataGhana.aab`, add release notes, save, and **Roll out**.
2. Add your own email as a tester, open the opt-in link on your phone, install, and check that everything works (buying as a guest, payment opening inside the app, login, agent screens).
3. Go to **Production → Create new release**, choose the same bundle (**Add from library**), and **Send for review**.

**Important rule for new accounts:** Google requires newly created *personal* developer accounts to run a **closed test with about 20 testers for 14 days** before they can publish to production. Organization accounts are exempt. Check the Dashboard for the current requirement. If it applies to you, ask friends and agents to join the closed test with their Google accounts.

Review usually takes from a few hours to several days.

### B7. Updating the Android app later

Run the Android workflow again. Download the new `.aab`. In Play Console create a new release in Production (or Testing first), upload it, and submit. Version numbers go up by themselves.

---

## Part C: iPhone and the App Store

**Cost:** US$99 per year for the Apple Developer Program. You do **not** need a Mac: GitHub builds the app on a Mac in the cloud. Part C is the longest because Apple needs a certificate and a profile, but you do it only once.

### C1. Join the Apple Developer Program
https://developer.apple.com/programs/enroll/ (individual accounts are quicker; organizations need a D-U-N-S number). Approval can take from a day to a couple of weeks.

### C2. Register your app ID
https://developer.apple.com/account → **Certificates, Identifiers & Profiles → Identifiers → +** → **App IDs → App** → description *ASBData Ghana*, Bundle ID **Explicit** `com.asbdataghana.app`. No extra capabilities are needed. Save.

### C3. Create the signing certificate
You need a certificate request file (CSR). On a Windows or Linux computer with OpenSSL installed:

```
openssl req -new -newkey rsa:2048 -nodes -keyout ios_distribution.key -out ios_distribution.csr -subj "/CN=ASBData Ghana/C=GH"
```

(On a Mac you can instead use Keychain Access → Certificate Assistant → *Request a Certificate from a Certificate Authority*.)

Then: Apple developer site → **Certificates → +** → **Apple Distribution** → upload `ios_distribution.csr` → download `distribution.cer`.

Turn it into a `.p12` file (choose a password and remember it):

```
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey ios_distribution.key -in distribution.pem -out ios_distribution.p12 -password pass:YOUR_PASSWORD
```

Keep `ios_distribution.key` and the `.p12` safe. Never put them in your repo.

### C4. Create the provisioning profile
**Profiles → + → App Store Connect** (under Distribution) → pick the app ID from C2 → pick the certificate from C3 → name it *ASBData Ghana AppStore* → download the `.mobileprovision` file.

### C5. Create an App Store Connect API key
https://appstoreconnect.apple.com → **Users and Access → Integrations → App Store Connect API → Team Keys → +** → name it *GitHub*, access **App Manager**. Download the `.p8` file (you can only download it once). Note the **Key ID** and the **Issuer ID** shown on that page.

### C6. Create the app record
App Store Connect → **My Apps → + → New App**: platform iOS, name *ASBData Ghana*, language English, bundle ID `com.asbdataghana.app`, SKU `asbdataghana-ios`, user access Full.

### C7. Add the 7 secrets in GitHub
Convert the two binary files to text:
- **Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ios_distribution.p12")) | Set-Clipboard` (repeat for the `.mobileprovision` file)
- **Mac/Linux:** `base64 -i ios_distribution.p12 | pbcopy`

**Settings → Secrets and variables → Actions → New repository secret:**

| Secret name | Value |
|---|---|
| `IOS_CERT_P12_BASE64` | the .p12 file as text |
| `IOS_CERT_PASSWORD` | the password you chose in C3 |
| `IOS_PROVISIONING_PROFILE_BASE64` | the .mobileprovision file as text |
| `IOS_TEAM_ID` | your 10-character Team ID (Apple developer site → Membership details) |
| `APPSTORE_ISSUER_ID` | Issuer ID from C5 |
| `APPSTORE_KEY_ID` | Key ID from C5 |
| `APPSTORE_PRIVATE_KEY` | open the .p8 file in a text editor and paste **everything** inside, including the BEGIN and END lines |

### C8. Build and upload
**Actions → Release iPhone app (App Store / TestFlight) → Run workflow.** It takes about 15 minutes, then the build shows up in App Store Connect under **TestFlight** after 10 to 20 more minutes of Apple processing. Install the **TestFlight** app on your iPhone, accept your own invite, and test the app properly (buying as a guest, in-app payment, login, agent screens).

The app version comes from `package.json` (run the Android workflow first to raise it, or edit `package.json` on GitHub). The build number goes up on every run.

### C9. Fill in the App Store listing
In App Store Connect open the app → the version page:
- **Screenshots:** iPhone only (the build is iPhone-only so you do not need iPad screenshots). Provide the **6.9-inch** set (1320×2868) or the 6.7-inch set (1290×2796): 3 to 10 images. Take them on a real iPhone, or in the Xcode simulator if a friend has a Mac. Use real screens.
- **Texts:** from `STORE-LISTING.md`. **Privacy policy URL:** https://asbdataghana.com/policy. **Support URL:** https://asbdataghana.com/support.
- **App Privacy** (the "nutrition label"): you collect Contact Info (name, email, phone), Identifiers (user ID), Purchases (order history), and optionally Photos. All are linked to the user, used for App Functionality, and **not** used for tracking. You do not collect payment card details.
- **Age rating:** answer the questionnaire (no objectionable content) and you should get 4+.
- **Pricing:** Free. **Availability:** Ghana (add more countries if you like).
- **Category:** Utilities (or Business).
- **App Review Information:** the reviewer account from A2 and these notes:

> ASBData Ghana sells mobile data bundles that are delivered to a mobile phone number on MTN, Telecel or AirtelTigo and used on the mobile network, outside the app. No account is needed to browse or buy as a guest. For the demo account, choose any bundle and pay with Wallet (it has a small balance). The Me tab includes Delete Account. Agent features let registered resellers manage their own store.

- **Export compliance:** the workflow already declares that the app uses no non-standard encryption.

Then pick the build you uploaded under **Build** and **Add for Review → Submit**.

**One risk to know about:** Apple requires in-app purchase for *digital* content sold inside an app. Data bundles are delivered to a phone number, outside the app, and most airtime and data apps are accepted on that basis. The paid **agent plans** (a website and storefront service) are the part a reviewer might question. If Apple rejects the app for that, set `HIDE_AGENT_PURCHASE_ON_IOS` to `true` in `www/js/config.js`, run the workflow again, and resubmit. On iPhone the plans screen then points people to your website for the purchase. Everything else stays in the app.

Review usually takes 24 to 48 hours. If you are rejected, read the message, fix it, and resubmit. Rejections on a first submission are normal.

### C10. Updating the iPhone app later
Run the Android workflow (to raise the version) or edit `package.json`, then run the iPhone workflow again. In App Store Connect create a new version, select the new build, and submit.

---

## Part D: Both stores

**Common reasons for rejection**
- Missing or broken account deletion (done in A1).
- Reviewer cannot log in, or the demo account has no balance (A2).
- Privacy policy link not working, or data answers that do not match what the app collects.
- Screenshots that do not look like the real app.
- Crashes: test the TestFlight and internal-test builds well before you submit.

**Keeping things in sync:** the Android and iPhone apps share one codebase (`www/`). Change a screen once, run both workflows, and update both stores.

**Direct-download APK:** `ASBDataGhana.apk` is for people who cannot use Google Play. That build shows an "update available" banner when you publish a newer release.

**Keep these safe forever:** your Android `.jks` key, your iOS `.p12` and `.key` files, the `.p8` file, and all passwords.
