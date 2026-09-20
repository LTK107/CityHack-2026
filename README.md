# Tanit XR

An interactive map of 3D-scanned archaeological heritage across Tunisia. The map
fills the left half of the screen; **Mura**, a Gemini-backed guide, stands in the
right half and talks you through whatever you open. Clicking a pin opens the full
record over it -- an auto-playing 3D scan, the description and the key features.

The repo is an npm workspace with two packages:

| Package  | Path      | What it is                                                        |
| -------- | --------- | ----------------------------------------------------------------- |
| `cityhack-web`    | `web/`    | Vite + React + Tailwind frontend: Leaflet map, pin cards, Mura the guide |
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

### Checking the scans

`npm run check:scans` calls Sketchfab's oEmbed API for every record and reports
three kinds of problem:

- **dead** — the model does not exist, so the embed would render Sketchfab's own
  404 page inside the viewer. Set the record's `uid` to `null` and it shows the
  "no scan linked yet" panel instead.
- **mismatched** — the uid resolves, but to a different object than the record
  names. The page looks fine until someone reads the label.
- **reused** — several records share one uid, which usually means placeholder
  data.

The check needs network access and exits non-zero if any uid is dead.

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

### Keeping the pin's card in frame

Leaflet anchors a popup to a geographic point, so zooming walks the card toward
a corner and eventually off screen. `KeepPopupFramed` in `MapView.jsx` listens
for `zoomend` and re-centres the view on the marker, offset by half the card's
*measured* height, so the card stays centred and whole at any zoom. Leaflet's own
`keepInView` covers dragging but not zooming, so both are used. The card itself
is sized in viewport units (`min(18rem, 100vw - 5rem)`, `max-h-[min(24rem,48vh)]`)
so it shrinks with the window instead of overflowing the map pane.

While a pin is open, the fit-to-bounds behaviour is suspended — the view belongs
to that pin until it is closed.

### Mura, the guide

Mura occupies the right half of the screen, with her speech bubble sitting over
her head and the figure beneath it. She is always present: before any pin is
opened her bubble invites you to pick one and lists the featured scans, and once
a site is open she summarises it, suggests three follow-up questions and takes
free-text questions.

There is no separate inspector panel and no "Inspect 3D Scan" step -- the pin's
own card carries the record, so a click on the map is the only action needed.

Her artwork is `web/public/mura.svg`. Replace that one file to change the
avatar; nothing else references the drawing.

The conversation lives in the `useGuide` hook (`web/src/hooks.js`), so the chat
logic is reusable if you want her somewhere else too.

Gemini intermittently answers `503 UNAVAILABLE` ("high demand") to requests it
serves fine moments later, so `askGuide` retries transient statuses four times
with exponential backoff and jitter. Genuine failures -- a bad key, a malformed
request -- are rethrown at once rather than retried. If the upstream is having a
bad day you may still see "the guide is unavailable"; Mura offers a retry
button, and raising the attempt count in `server/src/lib/gemini.js` trades
latency for reliability.

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
| `npm run check:scans` | Validate every `uid` against Sketchfab       |

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

- Basemaps are OpenStreetMap (street) and Esri World Imagery (satellite),
  neither of which needs an API key. CARTO's tiles still return HTTP 200 without
  a key but paint an "API KEY REQUIRED" watermark across every tile, so they are
  not used.
- Map pins are CSS-drawn SVG `divIcon`s, which avoids the bundler-path problem
  Leaflet's default marker images have.
- The dev server uses `strictPort`, so it fails loudly instead of sliding to
  5174 and falling out of the API's CORS allowlist.
- `server/.env` is gitignored. Never commit real credentials.
