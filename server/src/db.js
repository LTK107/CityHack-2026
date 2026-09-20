import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// node-postgres returns NUMERIC as a string to avoid float precision loss.
// Coordinates and prices are small enough that Number is safe and much easier
// to consume in the browser.
types.setTypeParser(types.builtins.NUMERIC, (value) =>
  value === null ? null : Number(value),
);

export const pool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
  max: config.db.max,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Stops a pathological query from pinning a connection forever.
  statement_timeout: 10_000,
  query_timeout: 10_000,
  application_name: 'cityhack-api',
});

pool.on('error', (error) => {
  // An idle client blew up (network drop, server restart). Log and let the pool
  // replace it -- throwing here would take the process down.
  console.error('[db] idle client error:', error.message);
});

/**
 * Every call site must pass values as `params`, never interpolate them into
 * `text`. This is the only place queries are issued from.
 */
export async function query(text, params = []) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - startedAt;

  if (!config.isProd && durationMs > 200) {
    console.warn(`[db] slow query ${durationMs}ms: ${text.split('\n')[0]}`);
  }
  return result;
}

export async function healthcheck() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}
