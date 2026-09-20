/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ONLY FILE YOU EDIT TO MATCH THE REAL DATABASE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything else in the server talks in the API field names on the left.
 * Point each one at the actual column on the right, or set it to `null` if the
 * column does not exist -- the API then simply omits that field.
 *
 * Run `npm run db:introspect` to print the live tables and columns.
 *
 * Identifiers here are interpolated into SQL, so they are validated against a
 * strict pattern at load time and never come from a request.
 */

export const TABLE = {
  schema: 'public',
  name: 'sites',
};

/** apiField -> database column (or null when the column does not exist) */
export const COLUMNS = {
  // --- required: the map cannot render without these ---
  id: 'id',
  name: 'name',
  latitude: 'latitude',
  longitude: 'longitude',

  // --- identity / copy ---
  slug: 'slug',
  shortDescription: 'short_description',
  description: 'description',
  category: 'category',
  thumbnailUrl: 'thumbnail_url',

  // --- the 3D scan ---
  // Whatever TannitXR needs to open a scan. Usually an id/handle, sometimes a URL.
  modelId: 'model_id',
  modelUrl: 'model_url',
  modelFormat: 'model_format',

  // --- tourism guide fields (budget + proximity features) ---
  address: 'address',
  admissionCost: 'admission_cost',
  currency: 'currency',
  openingHours: 'opening_hours',
  visitDurationMinutes: 'visit_duration_minutes',
  accessibility: 'accessibility',
  yearBuilt: 'year_built',
  website: 'website',

  // --- bookkeeping ---
  updatedAt: 'updated_at',
};

/** API fields a client may sort by. Anything else is rejected by validation. */
export const SORTABLE = ['name', 'category', 'admissionCost', 'updatedAt'];

/** API fields the free-text search runs across (must be text-ish columns). */
export const SEARCHABLE = ['name', 'shortDescription', 'description', 'address', 'category'];

// ─────────────────────────────────────────────────────────────────────────────
// Below this line is machinery; you should not need to touch it.
// ─────────────────────────────────────────────────────────────────────────────

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function assertIdentifier(value, label) {
  if (!IDENTIFIER.test(value)) {
    throw new Error(
      `Unsafe SQL identifier for ${label}: "${value}". ` +
        'Only letters, digits and underscores are allowed.',
    );
  }
  return value;
}

// Fail at boot, not at request time, if mapping.js has a typo.
assertIdentifier(TABLE.schema, 'TABLE.schema');
assertIdentifier(TABLE.name, 'TABLE.name');
for (const [apiField, column] of Object.entries(COLUMNS)) {
  if (column !== null) assertIdentifier(column, `COLUMNS.${apiField}`);
}

for (const required of ['id', 'name', 'latitude', 'longitude']) {
  if (!COLUMNS[required]) {
    throw new Error(`COLUMNS.${required} is required and cannot be null.`);
  }
}

/** API fields that are actually backed by a column. */
export const PRESENT_FIELDS = Object.keys(COLUMNS).filter((f) => COLUMNS[f] !== null);

export const qualifiedTable = `"${TABLE.schema}"."${TABLE.name}"`;

/** `"column" AS "apiField"` for every mapped field -- no `SELECT *`. */
export const selectList = PRESENT_FIELDS.map(
  (field) => `t."${COLUMNS[field]}" AS "${field}"`,
).join(',\n         ');

/** Quoted column for an API field, or null. Used only with whitelisted fields. */
export function columnFor(apiField) {
  const column = COLUMNS[apiField];
  return column ? `t."${column}"` : null;
}

export const sortableFields = SORTABLE.filter((f) => COLUMNS[f]);
export const searchableColumns = SEARCHABLE.filter((f) => COLUMNS[f]).map(columnFor);

/**
 * Normalises a database row into the shape the frontend expects. Keeps the
 * client free of null-checks for columns that simply do not exist.
 */
export function toSite(row) {
  if (!row) return null;

  const site = {
    id: String(row.id),
    name: row.name ?? 'Unnamed site',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };

  const optional = [
    'slug', 'shortDescription', 'description', 'category', 'thumbnailUrl',
    'modelId', 'modelUrl', 'modelFormat',
    'address', 'currency', 'openingHours', 'accessibility', 'website',
  ];
  for (const field of optional) {
    if (row[field] !== undefined && row[field] !== null) site[field] = row[field];
  }

  for (const field of ['admissionCost', 'visitDurationMinutes', 'yearBuilt']) {
    if (row[field] !== undefined && row[field] !== null) {
      const value = Number(row[field]);
      if (Number.isFinite(value)) site[field] = value;
    }
  }

  if (row.updatedAt instanceof Date) site.updatedAt = row.updatedAt.toISOString();
  else if (row.updatedAt) site.updatedAt = String(row.updatedAt);

  // A site is only placeable if both coordinates parsed.
  site.hasLocation = Number.isFinite(site.latitude) && Number.isFinite(site.longitude);

  return site;
}
