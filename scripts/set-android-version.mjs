// Usage: node scripts/set-android-version.mjs <versionName> <versionCode>
import fs from 'node:fs';
const [, , name, code] = process.argv;
const p = 'android/app/build.gradle';
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s.replace(/versionCode(\s*=?\s*)\d+/, `versionCode$1${code}`).replace(/versionName(\s*=?\s*)"[^"]*"/, `versionName$1"${name}"`);
if (s === before) console.warn('Warning: could not find versionCode/versionName to update');
fs.writeFileSync(p, s);
console.log(`Android version set to ${name} (${code})`);
