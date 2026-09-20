import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { config } from './config.js';

/**
 * ---------------------------------------------------------------------------
 *  THE SITE CATALOGUE
 * ---------------------------------------------------------------------------
 *
 * sites.json is read, validated and indexed exactly once, at boot. After that a
 * request never parses JSON, never lowercases a string, never sorts and never
 * copies the full list -- it walks a prebuilt index and materialises only the
 * page it is about to return.
 *
 * Record shape (only id and name are required):
 *   id            stable handle, also the URL segment
 *   name          display title
 *   location      human-readable place name
 *   lat, lng      map position; both or neither
 *   sketchfabUid  bare Sketchfab model uid, not a URL
 *   category      filter facet, e.g. Roman / Punic / Islamic
 *   era           free-text dating, e.g. "2nd Century AD"
 *   context       long-form copy, also the guide's source material
 *   highlights    short feature bullets
 *   suggestedQuestions  starter prompts offered by the guide
 *   sourceUrl     optional http(s) link; defaults to the Sketchfab model page
 */

const HTTP_URL = /^https?:\/\//i;

/** Numeric ids are accepted and stringified, so prototype data pastes straight in. */
const idField = z.preprocess(
  (value) => (typeof value === 'number' ? String(value) : value),
  z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'may only contain letters, digits, "-" and "_"'),
);

const recordSchema = z.object({
  id: idField,
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().max(400).nullish(),
  lat: z.coerce.number().min(-90).max(90).nullish(),
  lng: z.coerce.number().min(-180).max(180).nullish(),
  // The bare uid, so the frontend builds the embed URL itself. Rejecting a full
  // URL here keeps a hand-edited JSON file from injecting an arbitrary iframe.
  sketchfabUid: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{8,64}$/, 'must be the bare Sketchfab model uid, not a URL')
    .nullish(),
  category: z.string().trim().max(80).nullish(),
  era: z.string().trim().max(120).nullish(),
  context: z.string().trim().max(8000).nullish(),
  highlights: z.array(z.string().trim().min(1).max(200)).max(24).nullish(),
  // Hand-written openers the guide offers before the model suggests its own.
  suggestedQuestions: z.array(z.string().trim().min(1).max(300)).max(12).nullish(),
  // http(s) only -- this value ends up in an href.
  sourceUrl: z.string().trim().max(2000).regex(HTTP_URL, 'must be an http(s) URL').nullish(),
});

/**
 * Accepts the prototype's field names alongside the catalogue's own, so records
 * copied from either source load without a hand edit.
 */
const ALIASES = [
  ['location', 'locations'],
  ['sketchfabUid', 'uid'],
  ['context', 'description'],
];

function applyAliases(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;

  const aliased = { ...entry };
  for (const [canonical, alias] of ALIASES) {
    if (aliased[canonical] === undefined && aliased[alias] !== undefined) {
      aliased[canonical] = aliased[alias];
    }
  }
  return aliased;
}

/** A bad catalogue is a boot failure, not a runtime surprise. */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Drops empty optional fields so the client never null-checks them. */
function normalise(record) {
  const site = { id: record.id, name: record.name };

  for (const field of ['location', 'category', 'era', 'context', 'sketchfabUid', 'sourceUrl']) {
    const value = record[field];
    if (value !== undefined && value !== null && value !== '') site[field] = value;
  }

  // A pin needs both halves of the coordinate, so they travel together.
  if (Number.isFinite(record.lat) && Number.isFinite(record.lng)) {
    site.lat = record.lat;
    site.lng = record.lng;
  }

  // A record only earns a place on the map once it has a scan to open. Without
  // a uid it stays in the catalogue -- listed, searchable, still openable from
  // the explore strip -- but it gets no pin, and it is left out of the bounds
  // the map fits to. The raw coordinates stay on the record for reference.
  site.hasLocation = site.lat !== undefined && site.sketchfabUid !== undefined;

  if (record.highlights?.length) site.highlights = Object.freeze([...record.highlights]);
  if (record.suggestedQuestions?.length) {
    site.suggestedQuestions = Object.freeze([...record.suggestedQuestions]);
  }

  // Every scan has a canonical public page; derive it rather than storing it twice.
  if (!site.sourceUrl && site.sketchfabUid) {
    site.sourceUrl = `https://sketchfab.com/3d-models/${site.sketchfabUid}`;
  }

  return Object.freeze(site);
}

function loadCatalogue(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (cause) {
    return fail(`Cannot read the site catalogue at ${file}\n  ${cause.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return fail(`${file} is not valid JSON\n  ${cause.message}`);
  }

  if (!Array.isArray(parsed)) {
    return fail(`${file} must contain a JSON array of site records.`);
  }

  const issues = [];
  const seen = new Set();
  const records = [];

  parsed.forEach((entry, index) => {
    const result = recordSchema.safeParse(applyAliases(entry));

    if (!result.success) {
      const label = `record ${index}${entry?.id ? ` ("${entry.id}")` : ''}`;
      for (const issue of result.error.issues) {
        issues.push(`  - ${label}: ${issue.path.join('.') || '(root)'} ${issue.message}`);
      }
      return;
    }

    // A coordinate with only one half is a data bug, not a site without a pin.
    const hasLat = result.data.lat !== undefined && result.data.lat !== null;
    const hasLng = result.data.lng !== undefined && result.data.lng !== null;
    if (hasLat !== hasLng) {
      issues.push(`  - record ${index} ("${result.data.id}"): lat and lng must be given together`);
      return;
    }

    // Ids address records in URLs and in the chat payload, so collisions would
    // silently route requests to whichever copy happened to be indexed first.
    if (seen.has(result.data.id)) {
      issues.push(`  - record ${index}: duplicate id "${result.data.id}"`);
      return;
    }

    seen.add(result.data.id);
    records.push(normalise(result.data));
  });

  if (issues.length > 0) {
    return fail(`Invalid site records in ${file}:\n${issues.join('\n')}`);
  }

  return records;
}

const records = Object.freeze(loadCatalogue(config.sitesFile));

/** O(1) lookup for /api/sites/:id and the chat route. */
const byId = new Map(records.map((site) => [site.id, site]));

/**
 * One lowercase haystack per record, built once. Search is then a scan over
 * precomputed strings instead of rebuilding and lowercasing six fields per
 * record per request.
 */
const haystacks = records.map((site) =>
  [site.name, site.location, site.category, site.era, site.context, site.highlights?.join(' ')]
    .filter(Boolean)
    .join('\n')
    .toLowerCase(),
);

// One collator, reused. Constructing one per comparison is the classic way to
// make a sort an order of magnitude slower than it needs to be.
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const positions = records.map((_, index) => index);

// Sorts a record with no category last, whichever direction is asked for.
const LAST = '￿';

const orderBy = {
  name: Object.freeze(
    positions.slice().sort((a, b) => collator.compare(records[a].name, records[b].name)),
  ),
  id: Object.freeze(
    positions.slice().sort((a, b) => collator.compare(records[a].id, records[b].id)),
  ),
  category: Object.freeze(
    positions
      .slice()
      .sort(
        (a, b) =>
          collator.compare(records[a].category ?? LAST, records[b].category ?? LAST) ||
          collator.compare(records[a].name, records[b].name),
      ),
  ),
};

/** API fields a client may sort by. Anything else is rejected by validation. */
export const sortableFields = Object.freeze(Object.keys(orderBy));

/** Distinct categories with counts, for the map's filter pills. Counted once. */
const categoryCounts = new Map();
for (const site of records) {
  if (site.category) categoryCounts.set(site.category, (categoryCounts.get(site.category) ?? 0) + 1);
}

export const categories = Object.freeze(
  [...categoryCounts]
    .map(([name, count]) => Object.freeze({ name, count }))
    .sort((a, b) => collator.compare(a.name, b.name)),
);

export const siteCount = records.length;

/**
 * Bounding box of a set of records, as Leaflet's [[south, west], [north, east]].
 * The frontend fits this so every matching pin is on screen at once.
 */
function boundsOf(indices) {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  let found = false;

  for (const index of indices) {
    const site = records[index];
    if (!site.hasLocation) continue;

    found = true;
    if (site.lat < south) south = site.lat;
    if (site.lat > north) north = site.lat;
    if (site.lng < west) west = site.lng;
    if (site.lng > east) east = site.lng;
  }

  return found ? [[south, west], [north, east]] : null;
}

// The unfiltered box never changes, so it is computed once rather than per request.
const ALL_BOUNDS = boundsOf(positions);

/**
 * @param {object}  options
 * @param {string} [options.search]    free text across name, place, era, context, highlights
 * @param {string} [options.category]  exact category match
 * @param {'name'|'id'|'category'} [options.sort]
 * @param {'asc'|'desc'} [options.order]
 * @param {number} [options.limit]
 * @param {number} [options.offset]
 */
export function querySites({
  search,
  category,
  sort = 'name',
  order = 'asc',
  limit = 200,
  offset = 0,
} = {}) {
  const base = orderBy[sort] ?? orderBy.name;

  // Unfiltered listings reuse the frozen index outright -- no copy at all.
  let matches = base;
  let filtered = false;

  if (search || category) {
    const needle = search ? search.toLowerCase() : null;
    filtered = true;
    // One pass applies both filters and preserves the precomputed sort order.
    matches = base.filter(
      (index) =>
        (!category || records[index].category === category) &&
        (!needle || haystacks[index].includes(needle)),
    );
  }

  const total = matches.length;
  const descending = order === 'desc';

  // Walk only the requested window. Reversing or slicing the whole list would
  // cost O(n) per request to return at most `limit` records.
  const data = [];
  const end = Math.min(offset + limit, total);
  for (let position = offset; position < end; position += 1) {
    data.push(records[matches[descending ? total - 1 - position : position]]);
  }

  return {
    data,
    meta: {
      total,
      limit,
      offset,
      // Covers every match, not just this page, so the map frames the whole set.
      bounds: filtered ? boundsOf(matches) : ALL_BOUNDS,
    },
  };
}

export function getSite(id) {
  return byId.get(id) ?? null;
}
