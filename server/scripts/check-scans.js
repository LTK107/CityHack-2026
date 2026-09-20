/**
 * Validates every sketchfabUid in the catalogue against Sketchfab's oEmbed API.
 *
 *   npm run check:scans
 *
 * A uid can fail in two ways, and only the first is visible in the app:
 *   - dead: the model does not exist, so the embed renders Sketchfab's own 404
 *   - mismatched: the model exists but is a different object than the record
 *     claims, which looks fine until someone reads the label
 *
 * Reused uids are reported too, since a catalogue that points several records
 * at one scan is usually placeholder data rather than intent.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const file = path.resolve(serverRoot, process.env.SITES_FILE || 'data/sites.json');

/** Rough similarity, enough to tell "same object" from "completely different". */
function looksRelated(recordName, modelTitle) {
  const words = (value) =>
    new Set(
      String(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3),
    );

  const a = words(recordName);
  const b = words(modelTitle);
  if (a.size === 0 || b.size === 0) return true;

  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared > 0;
}

const sites = JSON.parse(readFileSync(file, 'utf8'));

const dead = [];
const mismatched = [];
const missing = [];
const seen = new Map();

for (const site of sites) {
  const uid = site.sketchfabUid ?? site.uid ?? null;
  const label = `${String(site.id).padStart(3)}  ${site.name}`;

  if (!uid) {
    missing.push(label);
    continue;
  }

  if (!seen.has(uid)) seen.set(uid, []);
  seen.get(uid).push(label);

  const endpoint = `https://sketchfab.com/oembed?url=${encodeURIComponent(
    `https://sketchfab.com/3d-models/${uid}`,
  )}`;

  try {
    const response = await fetch(endpoint, { headers: { 'User-Agent': 'tanit-xr-check' } });
    if (!response.ok) {
      dead.push(`${label}  [HTTP ${response.status}]  ${uid}`);
      continue;
    }

    const { title } = await response.json();
    if (!looksRelated(site.name, title)) {
      mismatched.push(`${label}\n       uid resolves to: ${title}`);
    }
  } catch (error) {
    dead.push(`${label}  [unreachable: ${error.message}]`);
  }
}

const reused = [...seen.entries()].filter(([, records]) => records.length > 1);

const section = (title, lines) => {
  if (lines.length === 0) return;
  console.log(`\n${title} (${lines.length})`);
  for (const line of lines) console.log(`  ${line}`);
};

console.log(`Checked ${sites.length} records in ${file}`);
section('DEAD -- embed will show Sketchfab\'s 404', dead);
section('MISMATCHED -- uid resolves to a different model', mismatched);
section('NO SCAN -- renders the "no scan linked yet" panel', missing);

if (reused.length > 0) {
  console.log(`\nREUSED uids (${reused.length})`);
  for (const [uid, records] of reused) {
    console.log(`  ${uid}`);
    for (const record of records) console.log(`      ${record}`);
  }
}

const broken = dead.length + mismatched.length;
console.log(
  broken === 0
    ? '\nAll scans resolve and match their records.'
    : `\n${broken} record(s) need attention.`,
);

process.exitCode = dead.length > 0 ? 1 : 0;
