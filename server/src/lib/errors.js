import { config } from '../config.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, 'bad_request', message, details);
export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'not_found', message);
export const unavailable = (message) => new ApiError(503, 'unavailable', message);

/** Wraps an async route so rejected promises reach the error handler. */
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` },
  });
}

/**
 * Single exit point for errors. Anything unrecognised becomes a generic 500 --
 * database messages and stack traces are logged, never returned to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity.
export function errorHandler(error, req, res, next) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) },
    });
  }

  if (error?.message?.startsWith('Origin not allowed')) {
    return res.status(403).json({
      error: { code: 'forbidden_origin', message: 'This origin is not permitted.' },
    });
  }

  // Body parser rejections (malformed JSON, oversized payload).
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'payload_too_large', message: 'Request body is too large.' },
    });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      error: { code: 'malformed_json', message: 'Request body is not valid JSON.' },
    });
  }

  console.error('[error]', error);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong.',
      ...(config.isProd ? {} : { debug: error?.message }),
    },
  });
}
