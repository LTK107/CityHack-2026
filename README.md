# CityHack-2026

Project for City Hack Gainesville 2026 — a map of 3D-scanned heritage sites,
with an AI tour guide for each one.

The repo is an npm workspace with two packages:

| Package  | Path      | What it is                                                        |
| -------- | --------- | ----------------------------------------------------------------- |
| `cityhack-web`    | `web/`    | Vite + React frontend: Leaflet map, filters, site details, guide chat |
| `cityhack-server` | `server/` | Express API over PostgreSQL, plus a server-side Gemini proxy      |

## Quick start

```bash
npm install          # installs both workspaces into one root node_modules
cp server/.env.example server/.env
npm run dev          # API on :4000, frontend on :5173
```

Open **http://localhost:5173**.

The frontend always fetches relative paths (`/api/...`), and the Vite dev server
forwards them to Express. That means no API host is baked into the code and CORS
never comes up locally. The header shows two status pills — `database` and
`guide` — so you can see at a glance what is wired up.

### Database

The API needs PostgreSQL. Without it the app loads but shows a "cannot reach
PostgreSQL" banner and an empty list; the banner clears itself once the database
is up, with no page reload needed.

With Docker:

```bash
docker run -d --name cityhack-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=cityhack -p 5432:5432 postgres:16

docker exec -i cityhack-pg psql -U postgres -d cityhack < server/db/schema.sql
docker exec -i cityhack-pg psql -U postgres -d cityhack < server/db/seed.sql
```

Then point `DATABASE_URL` in `server/.env` at it:

```
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/cityhack
```

`server/db/seed.sql` adds five Gainesville landmarks so the map has pins before
the real scan data lands.

For anything beyond local dev, create the read-only role instead — the API only
ever runs `SELECT`, so a leaked connection string should not be able to write:

```bash
# edit the CHANGE_ME password first
psql "$ADMIN_DATABASE_URL" -f server/db/readonly-role.sql
```

### The AI guide

`/api/chat` returns 503 until `GEMINI_API_KEY` is set in `server/.env`. The key
is used server-side only and must never reach the frontend bundle. Restart the
API after setting it.

### Matching the real database

`server/src/mapping.js` is the only file to edit when the production schema
differs from `db/schema.sql`. Point each API field at its real column, or set it
to `null` and the API omits the field. Run `npm run db:introspect` to print the
live tables and columns.

## Scripts

Run from the repo root:

| Script                 | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | API and frontend together; Ctrl-C stops both          |
| `npm run dev:api`      | API only (`node --watch`)                             |
| `npm run dev:web`      | Frontend only                                         |
| `npm run build`        | Production build into `web/dist`                      |
| `npm run preview`      | Serve the built bundle                                |
| `npm start`            | API without watch mode                                |
| `npm run db:introspect`| Print live tables and columns                         |

## API

| Endpoint                  | Notes                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `GET /health`             | `200` when the database answers, `503` when it does not      |
| `GET /api/sites`          | `search`, `category`, `maxCost`, `near=lat,lng`, `radiusKm`, `sort`, `order`, `limit`, `offset` |
| `GET /api/sites/categories` | Distinct categories with counts, for the filter control    |
| `GET /api/sites/:id`      | Matches on primary key or slug                               |
| `POST /api/chat`          | `{ siteId, message?, history? }` — omit `message` for the opening summary |

Responses are `{ data, meta? }`; errors are `{ error: { code, message } }`.

## Deploying the frontend

`npm run build` emits a static bundle in `web/dist`. Set `VITE_API_BASE` to the
public API origin at build time, and add that frontend origin to `CORS_ORIGINS`
in the server environment — the proxy only exists in dev.

## Notes

- The frontend dev server uses `strictPort`, so it fails loudly instead of
  sliding to 5174 and falling out of the API's CORS allowlist.
- Map tiles come from OpenStreetMap, so there is no map API key to manage.
- `server/.env` is gitignored. Never commit real credentials.
