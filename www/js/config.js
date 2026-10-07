// ASBData Ghana mobile app: settings you may want to change.
window.ASB = {
  API_BASE: 'https://api.asbdataghana.com/api/v1',   // same API as the website
  SITE: 'https://asbdataghana.com',                  // agent pages open here, in the phone's browser
  WHATSAPP: '2348135113960',
  PHONE: '+2348135113960',
  EMAIL: 'hello@asbdataghana.com',
  REPO: 'somboy015c/asbapp',                                  // filled in automatically by the release workflow
  APK_NAME: 'ASBDataGhana.apk',
  MIN_SPLASH_MS: 2600,
  // Onboarding pictures: replace these files (1080 x 1350) or point to your own.
  ONBOARDING: [
    'assets/onboarding/onboarding-1.png',
    'assets/onboarding/onboarding-2.png',
    'assets/onboarding/onboarding-3.png',
  ],
  NETWORKS: {
    mtn:        { name: 'MTN',        tag: 'MTN', bg: '#FFCB05', fg: '#1B1B1B' },
    telecel:    { name: 'Telecel',    tag: 'TL',  bg: '#E4002B', fg: '#FFFFFF' },
    airteltigo: { name: 'AirtelTigo', tag: 'AT',  bg: '#0B5FD8', fg: '#FFFFFF' },
  },
};
