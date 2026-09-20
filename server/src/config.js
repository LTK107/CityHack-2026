import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Environment is validated once, at boot. A missing or malformed value should
 * crash the process immediately rather than surface as a confusing 500 later.
 */
const csv = (value) =>
  String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/** Paths resolve against the server package, not the shell's working directory. */
const serverRoot = fileURLToPath(new URL('..', import.meta.url));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // The site catalogue. Relative paths are resolved against the server package.
  SITES_FILE: z.string().min(1).default('data/sites.json'),

  // Browsers that may call this API. Never "*" -- credentials are refused below.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Gemini key stays server-side. It must never reach the client bundle.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-flash-latest'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(15),

  // Set to 1 only when running behind a single trusted proxy (Render, Fly, nginx).
  // Leaving it off prevents clients from spoofing X-Forwarded-For to dodge limits.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  port: env.PORT,

  sitesFile: path.resolve(serverRoot, env.SITES_FILE),

  corsOrigins: csv(env.CORS_ORIGINS),

  gemini: {
    apiKey: env.GEMINI_API_KEY || null,
    model: env.GEMINI_MODEL,
    enabled: Boolean(env.GEMINI_API_KEY),
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    chatMax: env.CHAT_RATE_LIMIT_MAX,
  },

  trustProxy: env.TRUST_PROXY,
};
