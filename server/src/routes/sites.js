import { Router } from 'express';
import { z } from 'zod';
import { categories, getSite, querySites, sortableFields } from '../map.js';
import { badRequest, notFound } from '../lib/errors.js';

export const sitesRouter = Router();

const listQuerySchema = z.object({
  // Bounded so a client cannot ask for the whole catalogue in one go.
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  // Only fields the catalogue actually indexes reach the query.
  sort: z.enum(sortableFields).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const idParamSchema = z.object({
  id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid site id'),
});

function parseOrThrow(schema, value, label) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(
      `Invalid ${label}`,
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

// Handlers are synchronous: the catalogue is already in memory, so there is
// nothing to await. Express 5 forwards a thrown ApiError to the error handler.
sitesRouter.get('/', (req, res) => {
  const params = parseOrThrow(listQuerySchema, req.query, 'query parameters');
  res.json(querySites(params));
});

/** Distinct categories with counts, for the map's filter pills. */
sitesRouter.get('/categories', (_req, res) => {
  res.json({ data: categories });
});

// Declared after /categories so that literal path is not swallowed by :id.
sitesRouter.get('/:id', (req, res) => {
  const { id } = parseOrThrow(idParamSchema, req.params, 'site id');

  const site = getSite(id);
  if (!site) throw notFound(`No site matches "${id}"`);

  res.json({ data: site });
});
