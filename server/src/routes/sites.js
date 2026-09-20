import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { asyncRoute, badRequest, notFound } from '../lib/errors.js';
import {
  COLUMNS,
  columnFor,
  qualifiedTable,
  searchableColumns,
  selectList,
  sortableFields,
  toSite,
} from '../mapping.js';

export const sitesRouter = Router();

const listQuerySchema = z.object({
  // Bounded so a client cannot ask for the whole table in one go.
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  maxCost: z.coerce.number().min(0).max(100_000).optional(),
  // Proximity filter: centre point + radius in kilometres.
  near: z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, 'near must be "lat,lng"')
    .optional(),
  radiusKm: z.coerce.number().min(0.1).max(500).default(25),
  // Only fields declared sortable in mapping.js reach SQL.
  sort: z.enum(sortableFields.length ? sortableFields : ['name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const idParamSchema = z.object({
  // Accepts both integer ids and slugs/uuids without letting anything exotic through.
  id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid site id'),
});

function parseOrThrow(schema, value, label) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(`Invalid ${label}`, result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

/**
 * Haversine distance in km, expressed in SQL so filtering and sorting happen in
 * the database rather than over the full result set in Node.
 */
function distanceExpression(latParam, lngParam) {
  const lat = columnFor('latitude');
  const lng = columnFor('longitude');
  return `(6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($${latParam})) * cos(radians(${lat}))
              * cos(radians(${lng}) - radians($${lngParam}))
              + sin(radians($${latParam})) * sin(radians(${lat}))
            ))
          ))`;
}

sitesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params = parseOrThrow(listQuerySchema, req.query, 'query parameters');

    const values = [];
    const where = [
      `${columnFor('latitude')} IS NOT NULL`,
      `${columnFor('longitude')} IS NOT NULL`,
    ];
    let distanceSelect = '';
    let defaultOrder = null;

    if (params.search && searchableColumns.length > 0) {
      values.push(`%${params.search}%`);
      const placeholder = `$${values.length}`;
      const clauses = searchableColumns.map((column) => `${column}::text ILIKE ${placeholder}`);
      where.push(`(${clauses.join(' OR ')})`);
    }

    if (params.category && COLUMNS.category) {
      values.push(params.category);
      where.push(`${columnFor('category')} = $${values.length}`);
    }

    if (params.maxCost !== undefined && COLUMNS.admissionCost) {
      values.push(params.maxCost);
      // Free/unpriced sites stay in results -- a null cost is not "expensive".
      where.push(`(${columnFor('admissionCost')} IS NULL OR ${columnFor('admissionCost')} <= $${values.length})`);
    }

    if (params.near) {
      const [lat, lng] = params.near.split(',').map(Number);
      if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
        throw badRequest('near must be a valid "lat,lng" pair');
      }
      values.push(lat, lng, params.radiusKm);
      const latParam = values.length - 2;
      const lngParam = values.length - 1;
      const radiusParam = values.length;
      const distance = distanceExpression(latParam, lngParam);

      distanceSelect = `,\n         ${distance} AS "distanceKm"`;
      where.push(`${distance} <= $${radiusParam}`);
      defaultOrder = `${distance} ASC`;
    }

    const orderBy =
      defaultOrder ?? `${columnFor(params.sort)} ${params.order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;

    values.push(params.limit, params.offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;

    const whereSql = where.join('\n           AND ');

    const sql = `
      SELECT ${selectList}${distanceSelect}
        FROM ${qualifiedTable} t
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const countSql = `SELECT COUNT(*)::int AS total FROM ${qualifiedTable} t WHERE ${whereSql}`;
    // The count reuses the filter values but not LIMIT/OFFSET.
    const countValues = values.slice(0, values.length - 2);

    const [rows, counts] = await Promise.all([
      query(sql, values),
      query(countSql, countValues),
    ]);

    const sites = rows.rows.map((row) => {
      const site = toSite(row);
      if (row.distanceKm !== undefined && row.distanceKm !== null) {
        site.distanceKm = Math.round(Number(row.distanceKm) * 100) / 100;
      }
      return site;
    });

    res.json({
      data: sites,
      meta: {
        total: counts.rows[0]?.total ?? sites.length,
        limit: params.limit,
        offset: params.offset,
      },
    });
  }),
);

/** Distinct categories, for the map's filter control. */
sitesRouter.get(
  '/categories',
  asyncRoute(async (_req, res) => {
    if (!COLUMNS.category) return res.json({ data: [] });

    const { rows } = await query(`
      SELECT ${columnFor('category')} AS name, COUNT(*)::int AS count
        FROM ${qualifiedTable} t
       WHERE ${columnFor('category')} IS NOT NULL
       GROUP BY 1
       ORDER BY 1
    `);
    res.json({ data: rows });
  }),
);

sitesRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params, 'site id');

    // Match on the primary key or the slug, whichever the id looks like.
    // `::text` keeps the comparison valid for integer and uuid key types alike.
    const lookups = [`${columnFor('id')}::text = $1`];
    if (COLUMNS.slug) lookups.push(`${columnFor('slug')} = $1`);

    const { rows } = await query(
      `
      SELECT ${selectList}
        FROM ${qualifiedTable} t
       WHERE ${lookups.join(' OR ')}
       LIMIT 1
      `,
      [id],
    );

    const site = toSite(rows[0]);
    if (!site) throw notFound(`No site matches "${id}"`);

    res.json({ data: site });
  }),
);
