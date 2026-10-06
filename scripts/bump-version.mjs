// Usage: node scripts/bump-version.mjs <patch|minor|major> [exact-version]
// Bumps package.json and tells the app which GitHub repo to check for updates.
import fs from 'node:fs';

const [, , bump = 'patch', exact = ''] = process.argv;
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const current = pkg.version;

let next;
if (exact.trim()) {
  next = exact.trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(next)) { console.error(`"${exact}" is not a valid version (expected e.g. 1.4.0)`); process.exit(1); }
} else {
  let [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') { major++; minor = 0; patch = 0; }
  else if (bump === 'minor') { minor++; patch = 0; }
  else { patch++; }
  next = `${major}.${minor}.${patch}`;
}
pkg.version = next;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

if (process.env.GITHUB_REPOSITORY) {
  const p = 'www/js/config.js';
  const src = fs.readFileSync(p, 'utf8').replace(/REPO: '[^']*'/, `REPO: '${process.env.GITHUB_REPOSITORY}'`);
  fs.writeFileSync(p, src);
}

const [a, b, c] = next.split('.').map(Number);
const code = a * 10000 + b * 100 + c;       // Android versionCode: 1.2.3 -> 10203
console.log(`Version ${current} -> ${next} (build ${code})`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${next}\ncode=${code}\n`);
