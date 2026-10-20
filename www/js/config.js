// ASBData Ghana mobile app: settings you may want to change.
window.ASB = {
  API_BASE: 'https://api.asbdataghana.com/api/v1',   // same API as the website
  SITE: 'https://asbdataghana.com',                  // agent pages open here, in the phone's browser
  WHATSAPP: '2348135113960',
  PHONE: '+2348135113960',
  EMAIL: 'hello@asbdataghana.com',
  REPO: '__REPO__',                                  // filled in automatically by the release workflow
  APK_NAME: 'ASBDataGhana.apk',
  MIN_SPLASH_MS: 2600,
  // Onboarding pictures (4:5 portrait works best, e.g. 880 x 1100). Replace the files or point to your own.
  ONBOARDING: [
    'assets/onboarding/onboarding-1.jpg',
    'assets/onboarding/onboarding-2.jpg',
    'assets/onboarding/onboarding-3.jpg',
  ],
  // How the installed app finds out about updates:
  //   'off'    = never (use this for Google Play and App Store builds; the stores deliver updates)
  //   'github' = shows a banner when a newer ASBDataGhana.apk is published on GitHub (direct-download builds only)
  UPDATE_CHECK: 'off',
  // If Apple's review asks you to remove in-app purchase of agent plans, set this to true and rebuild.
  // On iPhone the plans screen then points to the website instead of selling them in the app.
  HIDE_AGENT_PURCHASE_ON_IOS: false,
  // Store links, used by the in-app "Rate the app" row once your listings are live (leave blank until then).
  PLAY_STORE_URL: '',
  APP_STORE_URL: '',
  PRIVACY_URL: 'https://asbdataghana.com/policy',
  DELETE_ACCOUNT_URL: 'https://asbdataghana.com/delete-account',
  NETWORKS: {
    mtn:        { name: 'MTN',        tag: 'MTN', bg: '#FFCB05', fg: '#1B1B1B' },
    telecel:    { name: 'Telecel',    tag: 'TL',  bg: '#E4002B', fg: '#FFFFFF' },
    airteltigo: { name: 'AirtelTigo', tag: 'AT',  bg: '#0B5FD8', fg: '#FFFFFF' },
  },
};
