# Tanit XR

An interactive map of 3D-scanned archaeological heritage across Tunisia, with a
Sketchfab inspector and an AI tour guide for each artifact.

The repo is an npm workspace with two packages:

| Package  | Path      | What it is                                                        |
| -------- | --------- | ----------------------------------------------------------------- |
| `cityhack-web`    | `web/`    | Vite + React + Tailwind frontend: Leaflet map, Sketchfab inspector, guide chat |
| `cityhack-server` | `server/` | Express API over a JSON catalogue, plus a server-side Gemini proxy |

There is no database. Site records live in `server/data/sites.json`.

## Quick start

```bash
npm install                        # installs both workspaces
cp server/.env.example server/.env # then add GEMINI_API_KEY
npm run dev                        # API :4000 + frontend :5173
```

Open **http://localhost:5173**.

The frontend always fetches relative paths (`/api/...`), and the Vite dev server
forwards them to Express. No API host is baked into the code and CORS never
comes up locally.

## The catalogue

`server/data/sites.json` is a JSON array. Only `id` and `name` are required:

```json
{
  "id": "tanit-stela-tophet",
  "name": "Tanit Stela – Tophet of Salammbo",
  "location": "Carthage",
  "lat": 36.8403,
  "lng": 10.3228,
  "sketchfabUid": "71e2a8a4ac67450c9fe375e183979ac0",
  "category": "Punic",
  "era": "4th–3rd Century BC",
  "context": "A Punic votive stela from the sacred Tophet ...",
  "highlights": ["Sign of Tanit Emblem", "Punic Votive Marker"]
}
```

| Field          | Notes                                                               |
| -------------- | ------------------------------------------------------------------- |
| `id`           | letters, digits, `-` and `_`; also the URL segment. Must be unique   |
| `name`         | display title                                                        |
| `location`     | human-readable place name                                            |
| `lat` / `lng`  | map position — **both or neither**; a record without them gets no pin |
| `sketchfabUid` | the **bare** model uid, not a URL                                    |
| `category`     | drives the filter pills over the map                                 |
| `era`          | free-text dating                                                     |
| `context`      | long-form copy; also the guide's source material                     |
| `highlights`   | short feature bullets                                                |
| `sourceUrl`    | optional; defaults to the Sketchfab model page for the uid           |

The loader also accepts the field names `locations`, `uid` and `description` as
aliases for `location`, `sketchfabUid` and `context`, and stringifies numeric
`id`s — so records pasted from a prototype load without a hand edit.

The file is validated at boot. A malformed record, a `sketchfabUid` that is a
URL, a half-written coordinate or a duplicate `id` stops the server with a
message naming the offending record, rather than failing later on a request.

`npm run dev` watches `server/data`, so editing the JSON restarts the API.

`sketchfabUid` is the id at the end of a Sketchfab model URL:

```
https://sketchfab.com/3d-models/some-model-name-a1b2c3d4e5f6...
                                                 ^^^^^^^^^^^^  this part
```

### `server/src/map.js`

The catalogue module. It reads, validates and indexes the JSON once at boot, so
a request never parses JSON, lowercases a string, sorts, or copies the full
list:

- records are frozen, so they are shared rather than defensively copied
- a `Map` gives O(1) lookup by `id`
- one prebuilt lowercase haystack per record backs free-text search across
  name, place, category, era, context and highlights
- name, id and category orderings are precomputed, so an unfiltered listing is
  an index walk with no sort at all
- category counts are tallied once, for the filter pills
- one reused `Intl.Collator` instead of a fresh comparator per comparison
- paging walks only the requested window, so `order=desc` never reverses the
  whole list
- **`meta.bounds`** is the bounding box of every match — not just the page on
  screen — so the map can frame the whole filtered set in one `fitBounds`. The
  unfiltered box is computed once at boot.

### The AI guide

`/api/chat` returns 503 until `GEMINI_API_KEY` is set in `server/.env`. The key
is used server-side only and must never reach the frontend bundle. Site facts —
name, place, category, era, coordinates, highlights, context — are pulled from
the catalogue, not from the request, so a client cannot feed the model invented
details. Restart the API after setting the key.

## Scripts

Run from the repo root:

| Script            | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | API and frontend together; Ctrl-C stops both     |
| `npm run dev:api` | API only, watching `src` and `data`              |
| `npm run dev:web` | Frontend only                                    |
| `npm run build`   | Production build into `web/dist`                 |
| `npm run preview` | Serve the built bundle                           |
| `npm start`       | API without watch mode                           |

## API

| Endpoint                    | Notes                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `GET /health`               | `{ status, sites, guide }`                                  |
| `GET /api/sites`            | `search`, `category`, `sort` (`name`\|`id`\|`category`), `order`, `limit`, `offset` |
| `GET /api/sites/categories` | Distinct categories with counts                             |
| `GET /api/sites/:id`        | One record by `id`                                          |
| `POST /api/chat`            | `{ siteId, message?, history? }` — omit `message` for the opening summary |

List responses are `{ data, meta: { total, limit, offset, bounds } }`; errors are
`{ error: { code, message } }`.

## Deploying the frontend

`npm run build` emits a static bundle in `web/dist`. Set `VITE_API_BASE` to the
public API origin at build time, and add that frontend origin to `CORS_ORIGINS`
in the server environment — the proxy only exists in dev.

## Notes

- Basemaps are CARTO Voyager (street) and Esri World Imagery (satellite);
  neither needs an API key.
- Map pins are CSS-drawn SVG `divIcon`s, which avoids the bundler-path problem
  Leaflet's default marker images have.
- The dev server uses `strictPort`, so it fails loudly instead of sliding to
  5174 and falling out of the API's CORS allowlist.
- `server/.env` is gitignored. Never commit real credentials.
