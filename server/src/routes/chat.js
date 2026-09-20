import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';
import { asyncRoute, badRequest, notFound, unavailable } from '../lib/errors.js';
import { askGuide, summaryPrompt } from '../lib/gemini.js';
import { COLUMNS, columnFor, qualifiedTable, selectList, toSite } from '../mapping.js';

export const chatRouter = Router();

const chatSchema = z.object({
  siteId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid site id'),
  // Empty message means "give me the opening summary for this site".
  message: z.string().trim().max(1000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(12)
    .default([]),
});

async function loadSite(id) {
  const lookups = [`${columnFor('id')}::text = $1`];
  if (COLUMNS.slug) lookups.push(`${columnFor('slug')} = $1`);

  const { rows } = await query(
    `SELECT ${selectList} FROM ${qualifiedTable} t WHERE ${lookups.join(' OR ')} LIMIT 1`,
    [id],
  );
  return toSite(rows[0]);
}

chatRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        'Invalid chat request',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    }
    const { siteId, history } = parsed.data;

    if (!config.gemini.enabled) {
      throw unavailable('The guide is offline: GEMINI_API_KEY is not configured on the server.');
    }

    // Context is fetched server-side so the client cannot feed the model
    // fabricated facts about a location.
    const site = await loadSite(siteId);
    if (!site) throw notFound(`No site matches "${siteId}"`);

    const message = parsed.data.message?.trim() || summaryPrompt(site);

    let result;
    try {
      result = await askGuide(site, history, message);
    } catch (error) {
      // Upstream errors can carry the API key's quota details -- log, don't forward.
      console.error('[chat] gemini request failed:', error?.message ?? error);
      throw unavailable('The guide is unavailable right now. Please try again shortly.');
    }

    if (!result) throw unavailable('The guide did not return an answer. Try rephrasing.');

    res.json({
      data: {
        siteId: site.id,
        reply: result.reply,
        followUps: result.followUps,
      },
    });
  }),
);
