/**
 * Prints the live database's tables and columns, then a ready-to-paste COLUMNS
 * block guessed from the column names. Run it and hand the output to whoever is
 * filling in src/mapping.js.
 *
 *   npm run db:introspect
 */
import { closePool, query } from '../src/db.js';

const SKIP_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

// apiField -> candidate column names, best match first.
const GUESSES = {
  id: ['id', 'site_id', 'uuid', 'pk'],
  name: ['name', 'title', 'site_name', 'label'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'x'],
  slug: ['slug', 'handle', 'code'],
  shortDescription: ['short_description', 'summary', 'subtitle', 'blurb', 'tagline'],
  description: ['description', 'details', 'long_description', 'about', 'body', 'notes'],
  category: ['category', 'type', 'kind', 'classification', 'tag'],
  thumbnailUrl: ['thumbnail_url', 'thumbnail', 'image_url', 'image', 'photo_url', 'preview_url'],
  modelId: ['model_id', 'scan_id', 'tannit_id', 'scene_id', 'asset_id', 'model_key'],
  modelUrl: ['model_url', 'scan_url', 'asset_url', 'glb_url', 'mesh_url', 'viewer_url'],
  modelFormat: ['model_format', 'format', 'file_type', 'mime_type'],
  address: ['address', 'street_address', 'location', 'street'],
  admissionCost: ['admission_cost', 'price', 'cost', 'admission', 'entry_fee', 'ticket_price'],
  currency: ['currency', 'currency_code'],
  openingHours: ['opening_hours', 'hours', 'schedule', 'open_hours'],
  visitDurationMinutes: ['visit_duration_minutes', 'duration_minutes', 'visit_duration', 'avg_visit_minutes'],
  accessibility: ['accessibility', 'accessible', 'ada', 'access_notes'],
  yearBuilt: ['year_built', 'built', 'year', 'construction_year', 'established'],
  website: ['website', 'url', 'homepage', 'link'],
  updatedAt: ['updated_at', 'modified_at', 'last_updated', 'updated'],
};

async function main() {
  const { rows } = await query(
    `SELECT table_schema, table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema <> ALL($1)
      ORDER BY table_schema, table_name, ordinal_position`,
    [SKIP_SCHEMAS],
  );

  if (rows.length === 0) {
    console.log('No user tables found. Is DATABASE_URL pointing at the right database?');
    return;
  }

  const tables = new Map();
  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tables.has(key)) tables.set(key, []);
    tables.get(key).push(row);
  }

  for (const [key, columns] of tables) {
    console.log(`\n${key}`);
    console.log('-'.repeat(key.length));
    for (const column of columns) {
      const nullable = column.is_nullable === 'YES' ? '' : ' NOT NULL';
      console.log(`  ${column.column_name.padEnd(28)} ${column.data_type}${nullable}`);
    }
  }

  // Guess against the table with the most map-shaped columns.
  let best = null;
  for (const [key, columns] of tables) {
    const names = new Set(columns.map((c) => c.column_name.toLowerCase()));
    const score = Object.values(GUESSES).filter((candidates) =>
      candidates.some((candidate) => names.has(candidate)),
    ).length;
    if (!best || score > best.score) best = { key, names, score };
  }

  const [schema, name] = best.key.split('.');
  console.log(`\n\n// Suggested src/mapping.js for ${best.key} (${best.score} fields matched).`);
  console.log(`// Verify every line before trusting it.\n`);
  console.log(`export const TABLE = { schema: '${schema}', name: '${name}' };\n`);
  console.log('export const COLUMNS = {');
  for (const [apiField, candidates] of Object.entries(GUESSES)) {
    const match = candidates.find((candidate) => best.names.has(candidate));
    console.log(`  ${apiField}: ${match ? `'${match}'` : 'null'},`);
  }
  console.log('};');
}

main()
  .catch((error) => {
    console.error('Introspection failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
