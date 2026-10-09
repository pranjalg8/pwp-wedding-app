// Builds CHANGELOG.md (repo root) from src/data/releases.json, which is also what the in-app What's new page reads.
//   node scripts/changelog.mjs            write CHANGELOG.md
//   node scripts/changelog.mjs --check    fail if CHANGELOG.md is out of date
//   node scripts/changelog.mjs --notes    print the newest version's notes (used for the GitHub release)
//   node scripts/changelog.mjs --latest   print the newest version number
//   node scripts/changelog.mjs --title    print the newest release title
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const releases = JSON.parse(readFileSync(new URL('../src/data/releases.json', import.meta.url), 'utf8'));
const LABEL = { new: 'New', improved: 'Improved', fix: 'Fixed' };

function section(r) {
  const lines = [`## ${r.version} - ${r.date}: ${r.title}`, ''];
  for (const kind of ['new', 'improved', 'fix']) {
    const items = r.items.filter((i) => i.kind === kind);
    if (!items.length) continue;
    lines.push(`**${LABEL[kind]}**`, '', ...items.map((i) => `- ${i.text}`), '');
  }
  return lines.join('\n');
}

const full = ['# What\'s new', '', 'Every version of the planner, newest first. This file is generated from `web/src/data/releases.json`; edit that file and run `npm run changelog`. The same list shows in the app under Activity, What\'s new.', '', ...releases.map(section)].join('\n').replace(/\n+$/, '\n');
const path = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url));
const arg = process.argv[2];

if (arg === '--notes') process.stdout.write(section(releases[0]));
else if (arg === '--title') process.stdout.write(`v${releases[0].version}: ${releases[0].title}`);
else if (arg === '--latest') process.stdout.write(releases[0].version);
else if (arg === '--check') {
  let current = '';
  try { current = readFileSync(path, 'utf8'); } catch { /* missing */ }
  if (current !== full) { console.error('CHANGELOG.md is out of date. Run: npm run changelog (in web/)'); process.exit(1); }
  console.log('CHANGELOG.md is up to date');
} else { writeFileSync(path, full); console.log('Wrote CHANGELOG.md'); }
