import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

/**
 * Security headers. This API serves JSON only, so the CSP can be maximally
 * restrictive -- the frontend is a separate origin with its own policy.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    // Only meaningful over HTTPS; harmless in local dev.
    hsts: config.isProd ? { maxAge: 15_552_000, includeSubDomains: true } : false,
  });
}

/**
 * Strict origin allowlist. Requests with no Origin header (curl, server-to-server,
 * same-origin navigations) are allowed through -- CORS is a browser control and
 * blocking them here would only break health checks, not stop an attacker.
 */
export function corsPolicy() {
  const allowed = new Set(config.corsOrigins);

  return cors({
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    // No cookies or Authorization headers are used, so credentials stay off.
    credentials: false,
    maxAge: 600,
  });
}

const limiterDefaults = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests. Slow down.' } },
};

/** Broad limit across the whole API. */
export const apiLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
});

/** Chat costs money per call, so it gets a much tighter budget. */
export const chatLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.chatMax,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many chat requests. Wait a moment before asking again.',
    },
  },
});
