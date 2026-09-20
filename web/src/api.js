/**
 * The single place the frontend talks to the API.
 *
 * Paths stay relative in development (Vite proxies them to Express). Set
 * VITE_API_BASE at build time to point a deployed bundle at another origin.
 */
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { body, signal, method } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    // An aborted request is a normal part of debounced filtering, not a failure.
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Cannot reach the API. Is the server running on port 4000?', {
      code: 'network',
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? `Request failed with status ${response.status}`, {
      status: response.status,
      code: error?.code,
      details: error?.details,
    });
  }

  return payload;
}

/** Drops empty values so they never become `?search=` in the URL. */
function toQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

export function listSites(params = {}, signal) {
  return request(`/api/sites${toQuery(params)}`, { signal });
}

export function listCategories(signal) {
  return request('/api/sites/categories', { signal });
}

export function getSite(id, signal) {
  return request(`/api/sites/${encodeURIComponent(id)}`, { signal });
}

/**
 * Omit `message` to get the guide's opening summary for a site.
 * `history` is the prior turns, newest last; the API caps it at 12.
 */
export function askGuide({ siteId, message, history = [] }, signal) {
  return request('/api/chat', {
    body: { siteId, ...(message ? { message } : {}), history: history.slice(-12) },
    signal,
  });
}

/**
 * /health answers 503 when the database is down, and that body is exactly what
 * we want to display -- so this deliberately does not treat 503 as a throw.
 */
export async function fetchHealth(signal) {
  try {
    const response = await fetch(`${BASE}/health`, { signal });
    const payload = await response.json().catch(() => null);
    return payload ?? { status: 'degraded', database: 'down' };
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    return { status: 'offline', database: 'down', unreachable: true };
  }
}
